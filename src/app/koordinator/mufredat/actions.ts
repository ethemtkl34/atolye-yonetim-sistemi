"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { haftaAraliginda } from "@/lib/mufredat";
import {
  alanHatalari,
  formDegerleri,
  type EylemDurumu,
} from "@/lib/formlar";

/**
 * Haftalık müfredat ve öğretmen adı işlemleri.
 *
 * Dönem ve kulüp aynı eylemleri paylaşır (`GRUP_SEMASI` gerekçesi: iki kopya
 * tutulsaydı biri güncellenip diğeri unutulurdu); hedef `MufredatHedefi` ile
 * ayrışır. Her işlem `yonetimZorunlu("mufredat", "TAM")` ile başlar — sayfa
 * kapısı yetmez, Server Action doğrudan çağrılabilir.
 *
 * Arşivli program düzenlenemez; TAMAMLANDI bilerek düzenlenebilir kalır:
 * "hangi hafta ne işlendi" kaydı dönem bittikten sonra da tamamlanabilmeli.
 */

export type MufredatHedefi = { tur: "donem" | "kulup"; id: string };

const mufredatSemasi = z.object({
  baslik: z
    .string()
    .trim()
    .min(2, "Başlık en az 2 karakter olmalı")
    .max(150, "Başlık en fazla 150 karakter olabilir"),
  aciklama: z
    .string()
    .trim()
    .max(2000, "Açıklama en fazla 2000 karakter olabilir")
    .optional()
    .transform((d) => (d ? d : null)),
});

const ogretmenSemasi = z.object({
  // Boş bırakmak geçerli: öğretmen adı silinmiş olur.
  ogretmenAdi: z
    .string()
    .trim()
    .max(100, "Öğretmen adı en fazla 100 karakter olabilir")
    .optional()
    .transform((d) => (d ? d : null)),
});

type ProgramBilgisi = {
  toplamHafta: number;
  atolyeProgramda: boolean;
  kilitSebebi: string | null;
};

/**
 * Hedef programı okur ve düzenleme ön koşullarını tek yerde toplar.
 * Program yoksa null döner.
 */
async function programBilgisi(
  hedef: MufredatHedefi,
  atolyeTipiId: string,
): Promise<ProgramBilgisi | null> {
  if (hedef.tur === "donem") {
    const donem = await db.term.findUnique({
      where: { id: hedef.id },
      select: {
        status: true,
        _count: { select: { weeks: true } },
        workshops: { where: { workshopTypeId: atolyeTipiId }, select: { id: true } },
      },
    });
    if (!donem) return null;
    return {
      toplamHafta: donem._count.weeks,
      atolyeProgramda: donem.workshops.length > 0,
      kilitSebebi:
        donem.status === "ARSIVLENDI"
          ? "Bu dönem arşivlenmiş; müfredatı düzenlenemez."
          : null,
    };
  }

  const kulup = await db.club.findUnique({
    where: { id: hedef.id },
    select: {
      status: true,
      weekDates: true,
      workshops: { where: { workshopTypeId: atolyeTipiId }, select: { id: true } },
    },
  });
  if (!kulup) return null;
  return {
    // Eski kulüplerde `weekDates` boş kalmış olabilir; detay sayfasındaki
    // okuma korumasının aynısı — tek günlük kulüp sayılır.
    toplamHafta: Math.max(kulup.weekDates.length, 1),
    atolyeProgramda: kulup.workshops.length > 0,
    kilitSebebi:
      kulup.status === "ARSIVLENDI"
        ? "Bu kulüp arşivlenmiş; müfredatı düzenlenemez."
        : kulup.status === "IPTAL_EDILDI"
          ? "Bu kulüp iptal edilmiş; müfredatı düzenlenemez."
          : null,
  };
}

/** Dönem haftalara, kulüp günlere bölünür; bildirimler buna göre yazılır. */
function birimAdi(tur: MufredatHedefi["tur"]): string {
  return tur === "donem" ? "haftanın" : "günün";
}

function mufredatYollariniYenile(hedef: MufredatHedefi): void {
  const kok = hedef.tur === "donem" ? "donemler" : "kulupler";
  revalidatePath(`/koordinator/${kok}/${hedef.id}`);
  revalidatePath(`/koordinator/${kok}/${hedef.id}/mufredat`);
}

/**
 * Bir haftanın konusunu yazar ya da günceller (upsert: hafta × atölye başına
 * tek girdi, eşzamanlı kayıtlar bileşik unique üzerinden aynı satıra düşer).
 */
export async function mufredatKaydet(
  hedef: MufredatHedefi,
  atolyeTipiId: string,
  haftaNo: number,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu("mufredat", "TAM");

  const cozumlenen = mufredatSemasi.safeParse({
    baslik: formVerisi.get("baslik"),
    aciklama: formVerisi.get("aciklama"),
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ["baslik", "aciklama"]),
    };
  }

  const program = await programBilgisi(hedef, atolyeTipiId);
  if (!program) return { hata: "Program bulunamadı." };
  if (program.kilitSebebi) return { hata: program.kilitSebebi };
  if (!program.atolyeProgramda) {
    return { hata: "Bu atölye bu programın müfredatında yok." };
  }
  if (!haftaAraliginda(haftaNo, program.toplamHafta)) {
    return { hata: "Hafta numarası programın takviminde yok." };
  }

  const konu = {
    title: cozumlenen.data.baslik,
    description: cozumlenen.data.aciklama,
  };

  // İki dal: bileşik unique'in null tarafı `where`'e yazılamıyor.
  if (hedef.tur === "donem") {
    await db.curriculumEntry.upsert({
      where: {
        termId_weekNumber_workshopTypeId: {
          termId: hedef.id,
          weekNumber: haftaNo,
          workshopTypeId: atolyeTipiId,
        },
      },
      create: { termId: hedef.id, weekNumber: haftaNo, workshopTypeId: atolyeTipiId, ...konu },
      update: konu,
    });
  } else {
    await db.curriculumEntry.upsert({
      where: {
        clubId_weekNumber_workshopTypeId: {
          clubId: hedef.id,
          weekNumber: haftaNo,
          workshopTypeId: atolyeTipiId,
        },
      },
      create: { clubId: hedef.id, weekNumber: haftaNo, workshopTypeId: atolyeTipiId, ...konu },
      update: konu,
    });
  }

  mufredatYollariniYenile(hedef);
  return { basari: `${haftaNo}. ${birimAdi(hedef.tur)} konusu kaydedildi.` };
}

/** Bir haftanın konusunu siler. */
export async function mufredatSil(girdiId: string): Promise<EylemDurumu> {
  await yonetimZorunlu("mufredat", "TAM");

  const girdi = await db.curriculumEntry.findUnique({
    where: { id: girdiId },
    select: {
      termId: true,
      clubId: true,
      weekNumber: true,
      term: { select: { status: true } },
      club: { select: { status: true } },
    },
  });

  if (!girdi) return { hata: "Müfredat girdisi bulunamadı." };

  if (girdi.term?.status === "ARSIVLENDI") {
    return { hata: "Bu dönem arşivlenmiş; müfredatı düzenlenemez." };
  }
  if (girdi.club?.status === "ARSIVLENDI" || girdi.club?.status === "IPTAL_EDILDI") {
    return { hata: "Bu kulüp kapanmış; müfredatı düzenlenemez." };
  }

  await db.curriculumEntry.delete({ where: { id: girdiId } });

  const hedef: MufredatHedefi = girdi.termId
    ? { tur: "donem", id: girdi.termId }
    : { tur: "kulup", id: girdi.clubId! };

  mufredatYollariniYenile(hedef);
  return {
    basari: `${girdi.weekNumber}. ${birimAdi(hedef.tur)} konusu silindi.`,
  };
}

/**
 * Program-atölye satırındaki öğretmen adını günceller. Boş gönderim adı
 * siler — "öğretmen henüz belli değil" geçerli bir durum.
 */
export async function ogretmenGuncelle(
  hedef: MufredatHedefi,
  programAtolyeId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu("mufredat", "TAM");

  const cozumlenen = ogretmenSemasi.safeParse({
    ogretmenAdi: formVerisi.get("ogretmenAdi"),
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ["ogretmenAdi"]),
    };
  }

  // Satırın gerçekten hedef programa ait olduğu doğrulanır: istemciden gelen
  // iki kimliğin tutarsız bileşimi başka programın satırını değiştirmemeli.
  if (hedef.tur === "donem") {
    const satir = await db.termWorkshop.findFirst({
      where: { id: programAtolyeId, termId: hedef.id },
      select: { term: { select: { status: true } } },
    });
    if (!satir) return { hata: "Atölye satırı bulunamadı." };
    if (satir.term.status === "ARSIVLENDI") {
      return { hata: "Bu dönem arşivlenmiş; öğretmen adı düzenlenemez." };
    }
    await db.termWorkshop.update({
      where: { id: programAtolyeId },
      data: { teacherName: cozumlenen.data.ogretmenAdi },
    });
  } else {
    const satir = await db.clubWorkshop.findFirst({
      where: { id: programAtolyeId, clubId: hedef.id },
      select: { club: { select: { status: true } } },
    });
    if (!satir) return { hata: "Atölye satırı bulunamadı." };
    if (satir.club.status === "ARSIVLENDI" || satir.club.status === "IPTAL_EDILDI") {
      return { hata: "Bu kulüp kapanmış; öğretmen adı düzenlenemez." };
    }
    await db.clubWorkshop.update({
      where: { id: programAtolyeId },
      data: { teacherName: cozumlenen.data.ogretmenAdi },
    });
  }

  mufredatYollariniYenile(hedef);
  return {
    basari: cozumlenen.data.ogretmenAdi
      ? "Öğretmen adı kaydedildi."
      : "Öğretmen adı silindi.",
  };
}
