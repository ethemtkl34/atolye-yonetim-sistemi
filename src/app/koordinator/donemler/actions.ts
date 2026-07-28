"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import {
  bugun,
  haftaCapasi,
  tarihCozumle,
  tarihMetni,
} from "@/lib/tarih";
import {
  donemOturumlariniUret,
  mevcutHaftaNumarasi,
} from "@/lib/session-generator";
import { DONEM_ATOLYE_SAYISI, HAFTA_SAYISI } from "@/lib/kurallar";
import { alanHatalari, GRUP_SEMASI } from "@/lib/formlar";

/** §4 — Dönem ve grup işlemleri. */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
};

/** Grup şeması dönem ve kulüpte ortak — tek kaynak `lib/formlar.ts`. */
const grupSemasi = GRUP_SEMASI;

const donemSemasi = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Dönem adı en az 2 karakter olmalı")
    .max(100, "Dönem adı en fazla 100 karakter olabilir"),
  description: z
    .string()
    .trim()
    .max(500, "Açıklama en fazla 500 karakter olabilir")
    .optional()
    .transform((d) => (d ? d : null)),
});

/**
 * Formdan gelen 10 tarihi doğrular ve hafta çapalarına çevirir.
 *
 * §4.1 — Haftalar takvimden tek tek seçilir; tatil haftaları seçilmez, bu
 * yüzden takvim 11–12 haftaya uzayabilir ve tarihler ardışık olmak zorunda
 * değildir. Zorunlu olan: tam 10 adet, hepsi hafta sonu, hepsi ayrı hafta.
 */
function haftalariDogrula(
  tarihMetinleri: string[],
): { hata: string } | { haftalar: Date[] } {
  if (tarihMetinleri.length !== HAFTA_SAYISI) {
    return {
      hata: `Tam ${HAFTA_SAYISI} eğitim haftası seçilmeli. Şu an ${tarihMetinleri.length} hafta seçili.`,
    };
  }

  const capalar: Date[] = [];

  for (const metin of tarihMetinleri) {
    const tarih = tarihCozumle(metin);
    if (!tarih) return { hata: `Geçersiz tarih: ${metin}` };

    const capa = haftaCapasi(tarih);
    if (!capa) {
      return {
        hata: `${metin} bir hafta sonu değil. Atölyeler yalnızca cumartesi ve pazar yapılır.`,
      };
    }

    capalar.push(capa);
  }

  const benzersiz = new Set(capalar.map(tarihMetni));
  if (benzersiz.size !== HAFTA_SAYISI) {
    return {
      hata: "Aynı hafta sonu birden fazla kez seçilmiş. Her hafta yalnızca bir kez seçilebilir.",
    };
  }

  capalar.sort((a, b) => a.getTime() - b.getTime());
  return { haftalar: capalar };
}

/** Dönemin 5 atölyesini doğrular. */
async function atolyeleriDogrula(
  atolyeIdleri: string[],
): Promise<{ hata: string } | { idler: string[] }> {
  if (atolyeIdleri.length !== DONEM_ATOLYE_SAYISI) {
    return {
      hata: `Tam ${DONEM_ATOLYE_SAYISI} atölye seçilmeli. Şu an ${atolyeIdleri.length} atölye seçili.`,
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
// Dönem oluşturma
// ---------------------------------------------------------------------------

export async function donemOlustur(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const donem = donemSemasi.safeParse({
    name: formVerisi.get("name"),
    description: formVerisi.get("description"),
  });

  const grup = grupSemasi.safeParse({
    name: formVerisi.get("grupAdi"),
    day: formVerisi.get("grupGunu"),
    timeSlot: formVerisi.get("grupZamanDilimi"),
    capacity: formVerisi.get("grupKontenjani"),
  });

  const hatalar: Record<string, string> = {};
  if (!donem.success) Object.assign(hatalar, alanHatalari(donem.error));
  if (!grup.success) {
    for (const [alan, mesaj] of Object.entries(alanHatalari(grup.error))) {
      hatalar[`grup.${alan}`] = mesaj;
    }
  }
  if (Object.keys(hatalar).length > 0) return { alanHatalari: hatalar };
  if (!donem.success || !grup.success) return { hata: "Form doğrulanamadı." };

  const haftaSonucu = haftalariDogrula(
    formVerisi.getAll("tarihler").map(String).filter(Boolean),
  );
  if ("hata" in haftaSonucu) return { hata: haftaSonucu.hata };

  const atolyeSonucu = await atolyeleriDogrula(
    formVerisi.getAll("atolyeler").map(String).filter(Boolean),
  );
  if ("hata" in atolyeSonucu) return { hata: atolyeSonucu.hata };

  // Dönem, haftaları, atölyeleri, ilk grubu ve grubun 50 oturumu tek işlemde
  // yazılır. Araya bir hata girerse yarım kalmış bir dönem oluşmamalı.
  const yeniDonem = await db.$transaction(async (tx) => {
    const olusturulan = await tx.term.create({
      data: {
        name: donem.data.name,
        description: donem.data.description,
        status: "KAYIT_ALIYOR",
        workshops: {
          create: atolyeSonucu.idler.map((atolyeId, sira) => ({
            workshopTypeId: atolyeId,
            sortOrder: sira,
          })),
        },
        weeks: {
          create: haftaSonucu.haftalar.map((tarih, sira) => ({
            weekNumber: sira + 1,
            date: tarih,
          })),
        },
      },
      include: { weeks: true },
    });

    const ilkGrup = await tx.group.create({
      data: {
        termId: olusturulan.id,
        name: grup.data.name,
        day: grup.data.day,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        startWeekNumber: 1,
      },
    });

    const oturumlar = donemOturumlariniUret({
      haftalar: olusturulan.weeks,
      atolyeIdleri: atolyeSonucu.idler,
      grupGunu: grup.data.day,
      baslangicHaftasi: 1,
    });

    await tx.session.createMany({
      data: oturumlar.map((oturum) => ({ ...oturum, groupId: ilkGrup.id })),
    });

    return olusturulan;
  });

  revalidatePath("/koordinator/donemler");
  revalidatePath("/koordinator/gruplar");
  redirect(`/koordinator/donemler/${yeniDonem.id}`);
}

// ---------------------------------------------------------------------------
// Dönem durumu
// ---------------------------------------------------------------------------

const DURUMLAR = [
  "TASLAK",
  "KAYIT_ALIYOR",
  "DEVAM_EDIYOR",
  "TAMAMLANDI",
  "ARSIVLENDI",
] as const;

export async function donemDurumDegistir(
  donemId: string,
  yeniDurum: (typeof DURUMLAR)[number],
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  if (!DURUMLAR.includes(yeniDurum)) {
    return { hata: "Geçersiz dönem durumu." };
  }

  await db.term.update({
    where: { id: donemId },
    data: { status: yeniDurum },
  });

  revalidatePath("/koordinator/donemler");
  revalidatePath(`/koordinator/donemler/${donemId}`);
  return { basari: "Dönem durumu güncellendi." };
}

// ---------------------------------------------------------------------------
// Gruba ekleme
// ---------------------------------------------------------------------------

/**
 * §4.2 — Döneme yeni grup ekler.
 *
 * §13.5 — Dönem başladıysa grup, geçmiş haftaları telafi etmeden mevcut
 * haftadan devam eder. Başlangıç haftası bugüne göre otomatik belirlenir;
 * koordinatöre kaç oturum üretildiği açıkça söylenir.
 */
export async function grupEkle(
  donemId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const grup = grupSemasi.safeParse({
    name: formVerisi.get("name"),
    day: formVerisi.get("day"),
    timeSlot: formVerisi.get("timeSlot"),
    capacity: formVerisi.get("capacity"),
  });

  if (!grup.success) {
    return { alanHatalari: alanHatalari(grup.error) };
  }

  const donem = await db.term.findUnique({
    where: { id: donemId },
    include: {
      weeks: { orderBy: { weekNumber: "asc" } },
      workshops: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!donem) return { hata: "Dönem bulunamadı." };

  const baslangicHaftasi = mevcutHaftaNumarasi(donem.weeks, bugun());

  if (baslangicHaftasi === null) {
    return {
      hata: "Bu dönemin bütün eğitim haftaları geçmiş. Yeni grup açılsa da hiç oturumu olmaz.",
    };
  }

  const atolyeIdleri = donem.workshops.map((w) => w.workshopTypeId);

  const oturumlar = donemOturumlariniUret({
    haftalar: donem.weeks,
    atolyeIdleri,
    grupGunu: grup.data.day,
    baslangicHaftasi,
  });

  await db.$transaction(async (tx) => {
    const yeniGrup = await tx.group.create({
      data: {
        termId: donemId,
        name: grup.data.name,
        day: grup.data.day,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        startWeekNumber: baslangicHaftasi,
      },
    });

    await tx.session.createMany({
      data: oturumlar.map((oturum) => ({ ...oturum, groupId: yeniGrup.id })),
    });
  });

  revalidatePath(`/koordinator/donemler/${donemId}`);
  revalidatePath("/koordinator/gruplar");

  const atlananHafta = baslangicHaftasi - 1;

  return {
    basari:
      atlananHafta > 0
        ? `"${grup.data.name}" eklendi. Dönem başladığı için grup ${baslangicHaftasi}. haftadan devam ediyor; ilk ${atlananHafta} hafta telafi edilmiyor. ${oturumlar.length} atölye oturumu oluşturuldu.`
        : `"${grup.data.name}" eklendi. ${oturumlar.length} atölye oturumu oluşturuldu.`,
  };
}

export async function grupDurumDegistir(
  grupId: string,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const grup = await db.group.findUnique({
    where: { id: grupId },
    select: { active: true, name: true, termId: true },
  });

  if (!grup) return { hata: "Grup bulunamadı." };

  await db.group.update({
    where: { id: grupId },
    data: { active: !grup.active },
  });

  if (grup.termId) revalidatePath(`/koordinator/donemler/${grup.termId}`);
  revalidatePath("/koordinator/gruplar");

  return {
    basari: grup.active
      ? `"${grup.name}" kapatıldı; yeni kayıt alınamaz.`
      : `"${grup.name}" yeniden açıldı.`,
  };
}
