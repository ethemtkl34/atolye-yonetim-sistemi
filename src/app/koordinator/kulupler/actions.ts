"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { alanHatalari, formDegerleri, GRUP_SEMASI } from "@/lib/formlar";
import {
  EN_AZ_HAFTA,
  EN_FAZLA_HAFTA,
  KULUP_ATOLYE_SAYISI,
} from "@/lib/kurallar";
import { kulupOturumlariniUret } from "@/lib/session-generator";
import { gunundenGun, tarihBicimle, tarihCozumle } from "@/lib/tarih";
import { KULUP_DURUMLARI, KULUP_DURUM_GECISLERI } from "@/lib/durumlar";
import type { ClubStatus } from "@/generated/prisma/enums";

/** §5 — Kulüp programı, kulüp grupları ve durum geçişleri. */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /** Doğrulama hatasında girilen değerler — form sıfırlanınca geri yazılır. */
  degerler?: Record<string, string>;
};

/** Kulüp sihirbazının metin/seçim alanları (atölye seçimi hariç). */
const KULUP_FORM_ALANLARI = [
  "name",
  "description",
  "grupAdi",
  "grupZamanDilimi",
  "grupKontenjani",
] as const;

const KULUP_GRUP_FORM_ALANLARI = ["name", "timeSlot", "capacity"] as const;

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

/** Kulüp grubunda gün sorulmaz; kulübün ilk toplanma gününden türetilir. */
const kulupGrubuSemasi = GRUP_SEMASI.omit({ day: true });

/**
 * Kulübün toplanma günlerini doğrular.
 *
 * Kulüp eskiden TEK yarım gündü; artık haftalara yayılabiliyor ve hafta
 * sayısı serbest. Günlerin hepsi hafta sonuna denk gelmeli — kulübün tanımı
 * bu — ama kaç tane olduğuna kurum karar veriyor.
 */
function kulupGunleriniDogrula(
  metinler: string[],
): { hata: string } | { tarihler: Date[] } {
  if (metinler.length < EN_AZ_HAFTA) {
    return { hata: "En az bir kulüp günü seçilmeli." };
  }
  if (metinler.length > EN_FAZLA_HAFTA) {
    return {
      hata: `En fazla ${EN_FAZLA_HAFTA} gün seçilebilir. Şu an ${metinler.length} gün seçili.`,
    };
  }

  const tarihler: Date[] = [];
  for (const metin of metinler) {
    const tarih = tarihCozumle(metin);
    if (!tarih) return { hata: `Geçersiz tarih: ${metin}` };

    if (!gunundenGun(tarih)) {
      return {
        hata: `${tarihBicimle(tarih)} bir hafta sonu değil. Kulüpler yalnızca cumartesi veya pazar yapılır.`,
      };
    }
    tarihler.push(tarih);
  }

  const benzersiz = new Set(tarihler.map((t) => t.toISOString()));
  if (benzersiz.size !== tarihler.length) {
    return { hata: "Aynı gün birden fazla kez seçilmiş." };
  }

  tarihler.sort((a, b) => a.getTime() - b.getTime());
  return { tarihler };
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
  const kullanici = await yonetimZorunlu();

  const kulup = kulupSemasi.safeParse({
    name: formVerisi.get("name"),
    description: formVerisi.get("description"),
  });

  const grup = kulupGrubuSemasi.safeParse({
    name: formVerisi.get("grupAdi"),
    timeSlot: formVerisi.get("grupZamanDilimi"),
    capacity: formVerisi.get("grupKontenjani"),
  });

  const girilenler = formDegerleri(formVerisi, KULUP_FORM_ALANLARI);

  const hatalar: Record<string, string> = {};
  if (!kulup.success) Object.assign(hatalar, alanHatalari(kulup.error));
  if (!grup.success) {
    for (const [alan, mesaj] of Object.entries(alanHatalari(grup.error))) {
      hatalar[`grup.${alan}`] = mesaj;
    }
  }
  if (Object.keys(hatalar).length > 0) {
    return { alanHatalari: hatalar, degerler: girilenler };
  }
  if (!kulup.success || !grup.success) return { hata: "Form doğrulanamadı." };

  const tarihSonucu = kulupGunleriniDogrula(
    formVerisi.getAll("tarihler").map(String).filter(Boolean),
  );
  if ("hata" in tarihSonucu) {
    return { hata: tarihSonucu.hata, degerler: girilenler };
  }

  const atolyeSonucu = await atolyeleriDogrula(
    formVerisi.getAll("atolyeler").map(String).filter(Boolean),
  );
  if ("hata" in atolyeSonucu) {
    return { hata: atolyeSonucu.hata, degerler: girilenler };
  }

  // Grubun günü İLK toplanma gününden türetiliyor: kulüp grubu haftadan
  // haftaya gün değiştirmez, cumartesi kulübü hep cumartesi toplanır.
  // Farklı bir gün gerekiyorsa grup takviminden o gün taşınır.
  const gun = gunundenGun(tarihSonucu.tarihler[0]);
  if (!gun) return { hata: "Kulüp günü hafta sonuna denk gelmeli." };

  // Kulüp, atölyeleri, ilk grubu ve grubun 3 oturumu tek işlemde yazılır.
  const yeniKulup = await db.$transaction(async (tx) => {
    const olusturulan = await tx.club.create({
      data: {
        name: kulup.data.name,
        description: kulup.data.description,
        // `date` ilk toplanma günü; listeler ve sıralama onu okuyor.
        date: tarihSonucu.tarihler[0],
        weekDates: tarihSonucu.tarihler,
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
        branchId: kullanici.aktifSubeId,
        name: grup.data.name,
        day: gun,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        // Kulüpte hafta kavramı yok; §13.5 kuralı yalnızca dönemler içindir.
        startWeekNumber: 1,
      },
    });

    const oturumlar = kulupOturumlariniUret({
      tarihler: tarihSonucu.tarihler,
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
  await yonetimZorunlu();

  if (!DURUMLAR.includes(yeniDurum)) {
    return { hata: "Geçersiz kulüp durumu." };
  }

  const kulup = await db.club.findUnique({
    where: { id: kulupId },
    select: { status: true },
  });
  if (!kulup) return { hata: "Kulüp bulunamadı." };
  if (kulup.status === yeniDurum) return { basari: "Kulüp zaten bu durumda." };

  // Her durumdan her duruma geçilemez; izinli geçişler tek kaynaktan okunur.
  if (!KULUP_DURUM_GECISLERI[kulup.status].includes(yeniDurum)) {
    return {
      hata: `"${KULUP_DURUMLARI[kulup.status].etiket}" durumundan "${KULUP_DURUMLARI[yeniDurum].etiket}" durumuna doğrudan geçilemez.`,
    };
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
  const kullanici = await yonetimZorunlu();

  const grup = kulupGrubuSemasi.safeParse({
    name: formVerisi.get("name"),
    timeSlot: formVerisi.get("timeSlot"),
    capacity: formVerisi.get("capacity"),
  });

  if (!grup.success) {
    return {
      alanHatalari: alanHatalari(grup.error),
      degerler: formDegerleri(formVerisi, KULUP_GRUP_FORM_ALANLARI),
    };
  }

  const kulup = await db.club.findUnique({
    where: { id: kulupId },
    include: { workshops: { orderBy: { sortOrder: "asc" } } },
  });

  if (!kulup) return { hata: "Kulüp bulunamadı." };

  // Kapanmış (tamamlanmış, iptal edilmiş veya arşivlenmiş) kulübe grup
  // açılamaz — açılsaydı hiçbir kayıt alamayacak bir grup oluşurdu.
  if (kulup.status !== "TASLAK" && kulup.status !== "KAYIT_ALIYOR") {
    return {
      hata: `Bu kulüp "${KULUP_DURUMLARI[kulup.status].etiket}" durumunda; yeni grup eklenemez.`,
    };
  }

  const gun = gunundenGun(kulup.date);
  if (!gun) {
    return { hata: "Kulüp tarihi hafta sonuna denk gelmiyor; grup eklenemez." };
  }

  // Eski kulüplerde `weekDates` boş kalmış olabilir; o zaman tek gün
  // (`date`) kullanılır — migration bunu dolduruyor ama okuma tarafı da
  // kendini korusun.
  const gunler = kulup.weekDates.length > 0 ? kulup.weekDates : [kulup.date];

  const oturumlar = kulupOturumlariniUret({
    tarihler: gunler,
    atolyeIdleri: kulup.workshops.map((atolye) => atolye.workshopTypeId),
  });

  await db.$transaction(async (tx) => {
    const yeniGrup = await tx.group.create({
      data: {
        clubId: kulupId,
        branchId: kullanici.aktifSubeId,
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
  const kullanici = await yonetimZorunlu();

  const grup = await db.group.findFirst({
    where: { id: grupId, branchId: kullanici.aktifSubeId },
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
