"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { alanHatalari, GRUP_SEMASI } from "@/lib/formlar";
import { KULUP_ATOLYE_SAYISI } from "@/lib/kurallar";
import { kulupOturumlariniUret } from "@/lib/session-generator";
import { gunundenGun, tarihBicimle, tarihCozumle } from "@/lib/tarih";
import type { ClubStatus } from "@/generated/prisma/enums";

/** §5 — Kulüp programı, kulüp grupları ve durum geçişleri. */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
};

const kulupSemasi = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Kulüp adı en az 2 karakter olmalı")
    .max(100, "Kulüp adı en fazla 100 karakter olabilir"),
  description: z
    .string()
    .trim()
    .max(500, "Açıklama en fazla 500 karakter olabilir")
    .optional()
    .transform((d) => (d ? d : null)),
});

/** Kulüp grubunda gün sorulmaz; kulübün tarihinden türetilir (aşağıdaki nota bakın). */
const kulupGrubuSemasi = GRUP_SEMASI.omit({ day: true });

/**
 * Kulüp tarihini doğrular.
 *
 * §5.1 kulübün tek bir tarihi olduğunu, §2.3 ise grubun cumartesi veya pazar
 * toplandığını söylüyor. Kulübün tek tarihi olduğu için grubun günü serbest
 * bir seçim olamaz: tarih cumartesiye denk geliyorsa grup cumartesi grubudur.
 * Bu yüzden gün formda sorulmuyor, tarihten türetiliyor; kulüp grupları
 * birbirinden **zaman dilimiyle** ayrışır (§5.2).
 */
function kulupTarihiniDogrula(metin: string): { hata: string } | { tarih: Date } {
  const tarih = tarihCozumle(metin);
  if (!tarih) return { hata: "Geçerli bir kulüp tarihi seçin." };

  if (!gunundenGun(tarih)) {
    return {
      hata: `${tarihBicimle(tarih)} bir hafta sonu değil. Kulüpler yalnızca cumartesi veya pazar yapılır.`,
    };
  }

  return { tarih };
}

/** §5.1 — Kulüpte tam 3 atölye bulunur (§13.6). */
async function atolyeleriDogrula(
  atolyeIdleri: string[],
): Promise<{ hata: string } | { idler: string[] }> {
  if (atolyeIdleri.length !== KULUP_ATOLYE_SAYISI) {
    return {
      hata: `Tam ${KULUP_ATOLYE_SAYISI} atölye seçilmeli. Şu an ${atolyeIdleri.length} atölye seçili.`,
    };
  }

  if (new Set(atolyeIdleri).size !== atolyeIdleri.length) {
    return { hata: "Aynı atölye birden fazla kez seçilmiş." };
  }

  const bulunan = await db.workshopType.count({
    where: { id: { in: atolyeIdleri }, active: true },
  });

  if (bulunan !== atolyeIdleri.length) {
    return {
      hata: "Seçilen atölyelerden biri artık mevcut değil veya pasife alınmış.",
    };
  }

  return { idler: atolyeIdleri };
}

// ---------------------------------------------------------------------------
// Kulüp oluşturma
// ---------------------------------------------------------------------------

export async function kulupOlustur(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const kulup = kulupSemasi.safeParse({
    name: formVerisi.get("name"),
    description: formVerisi.get("description"),
  });

  const grup = kulupGrubuSemasi.safeParse({
    name: formVerisi.get("grupAdi"),
    timeSlot: formVerisi.get("grupZamanDilimi"),
    capacity: formVerisi.get("grupKontenjani"),
  });

  const hatalar: Record<string, string> = {};
  if (!kulup.success) Object.assign(hatalar, alanHatalari(kulup.error));
  if (!grup.success) {
    for (const [alan, mesaj] of Object.entries(alanHatalari(grup.error))) {
      hatalar[`grup.${alan}`] = mesaj;
    }
  }
  if (Object.keys(hatalar).length > 0) return { alanHatalari: hatalar };
  if (!kulup.success || !grup.success) return { hata: "Form doğrulanamadı." };

  const tarihSonucu = kulupTarihiniDogrula(String(formVerisi.get("date") ?? ""));
  if ("hata" in tarihSonucu) return { hata: tarihSonucu.hata };

  const atolyeSonucu = await atolyeleriDogrula(
    formVerisi.getAll("atolyeler").map(String).filter(Boolean),
  );
  if ("hata" in atolyeSonucu) return { hata: atolyeSonucu.hata };

  const gun = gunundenGun(tarihSonucu.tarih);
  if (!gun) return { hata: "Kulüp tarihi hafta sonuna denk gelmeli." };

  // Kulüp, atölyeleri, ilk grubu ve grubun 3 oturumu tek işlemde yazılır.
  const yeniKulup = await db.$transaction(async (tx) => {
    const olusturulan = await tx.club.create({
      data: {
        name: kulup.data.name,
        description: kulup.data.description,
        date: tarihSonucu.tarih,
        status: "KAYIT_ALIYOR",
        workshops: {
          create: atolyeSonucu.idler.map((atolyeId, sira) => ({
            workshopTypeId: atolyeId,
            sortOrder: sira,
          })),
        },
      },
    });

    const ilkGrup = await tx.group.create({
      data: {
        clubId: olusturulan.id,
        name: grup.data.name,
        day: gun,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        // Kulüpte hafta kavramı yok; §13.5 kuralı yalnızca dönemler içindir.
        startWeekNumber: 1,
      },
    });

    const oturumlar = kulupOturumlariniUret({
      tarih: tarihSonucu.tarih,
      atolyeIdleri: atolyeSonucu.idler,
    });

    await tx.session.createMany({
      data: oturumlar.map((oturum) => ({ ...oturum, groupId: ilkGrup.id })),
    });

    return olusturulan;
  });

  revalidatePath("/koordinator/kulupler");
  revalidatePath("/koordinator/gruplar");
  redirect(`/koordinator/kulupler/${yeniKulup.id}`);
}

// ---------------------------------------------------------------------------
// Kulüp durumu
// ---------------------------------------------------------------------------

const DURUMLAR = [
  "TASLAK",
  "KAYIT_ALIYOR",
  "TAMAMLANDI",
  "IPTAL_EDILDI",
  "ARSIVLENDI",
] as const;

export async function kulupDurumDegistir(
  kulupId: string,
  yeniDurum: ClubStatus,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  if (!DURUMLAR.includes(yeniDurum)) {
    return { hata: "Geçersiz kulüp durumu." };
  }

  await db.club.update({
    where: { id: kulupId },
    data: { status: yeniDurum },
  });

  revalidatePath("/koordinator/kulupler");
  revalidatePath(`/koordinator/kulupler/${kulupId}`);
  // Durum değişince kulüp aktif listelerden arşive (ya da tersine) geçebilir.
  revalidatePath("/koordinator/arsiv");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator");
  return { basari: "Kulüp durumu güncellendi." };
}

// ---------------------------------------------------------------------------
// Kulübe grup ekleme
// ---------------------------------------------------------------------------

/**
 * §5.2 — Kontenjan dolduğunda aynı kulübe yeni grup eklenir.
 *
 * Yeni grup aynı 3 atölyeyi kullanır ve aynı gün toplanır; ayrıştığı yer
 * zaman dilimidir. Oturumlar P4'teki aynı üretici ile yazılır.
 */
export async function kulupGrupEkle(
  kulupId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const grup = kulupGrubuSemasi.safeParse({
    name: formVerisi.get("name"),
    timeSlot: formVerisi.get("timeSlot"),
    capacity: formVerisi.get("capacity"),
  });

  if (!grup.success) return { alanHatalari: alanHatalari(grup.error) };

  const kulup = await db.club.findUnique({
    where: { id: kulupId },
    include: { workshops: { orderBy: { sortOrder: "asc" } } },
  });

  if (!kulup) return { hata: "Kulüp bulunamadı." };

  const gun = gunundenGun(kulup.date);
  if (!gun) {
    return { hata: "Kulüp tarihi hafta sonuna denk gelmiyor; grup eklenemez." };
  }

  const oturumlar = kulupOturumlariniUret({
    tarih: kulup.date,
    atolyeIdleri: kulup.workshops.map((atolye) => atolye.workshopTypeId),
  });

  await db.$transaction(async (tx) => {
    const yeniGrup = await tx.group.create({
      data: {
        clubId: kulupId,
        name: grup.data.name,
        day: gun,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        startWeekNumber: 1,
      },
    });

    await tx.session.createMany({
      data: oturumlar.map((oturum) => ({ ...oturum, groupId: yeniGrup.id })),
    });
  });

  revalidatePath(`/koordinator/kulupler/${kulupId}`);
  revalidatePath("/koordinator/gruplar");

  return {
    basari: `"${grup.data.name}" eklendi. ${oturumlar.length} atölye oturumu oluşturuldu.`,
  };
}

export async function kulupGrupDurumDegistir(
  grupId: string,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const grup = await db.group.findUnique({
    where: { id: grupId },
    select: { active: true, name: true, clubId: true },
  });

  if (!grup) return { hata: "Grup bulunamadı." };

  await db.group.update({
    where: { id: grupId },
    data: { active: !grup.active },
  });

  if (grup.clubId) revalidatePath(`/koordinator/kulupler/${grup.clubId}`);
  revalidatePath("/koordinator/gruplar");

  return {
    basari: grup.active
      ? `"${grup.name}" kapatıldı; yeni kayıt alınamaz.`
      : `"${grup.name}" yeniden açıldı.`,
  };
}
