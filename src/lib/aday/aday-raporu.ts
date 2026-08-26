import type { LeadLossReason, LeadSource } from "@/generated/prisma/enums";
import { adayAralikKosulu } from "@/lib/aday-durumlari";
import { db } from "@/lib/db";
import { bugun } from "@/lib/tarih";

/**
 * §16.7 — Kaynak bazlı dönüşüm raporu.
 *
 * Eksen `createdAt` (kohort mantığı): "Ağustos'ta gelen Meta adaylarının kaçı
 * kazanıldı". Dönüşüm ANINA göre saymak ("Ağustos'ta kaç dönüşüm oldu") başka
 * bir soru; ikisi karıştırılırsa reklam bütçesi yanlış okunur. V1 yalnız
 * kohortu cevaplıyor.
 */

export const RAPOR_DONEMLERI = ["buAy", "gecenAy", "son3Ay", "tumu"] as const;
export type RaporDonemi = (typeof RAPOR_DONEMLERI)[number];

export const DONEM_ETIKETLERI: Record<RaporDonemi, string> = {
  buAy: "Bu ay",
  gecenAy: "Geçen ay",
  son3Ay: "Son 3 ay",
  tumu: "Tümü",
};

export function raporDonemiCoz(deger: unknown): RaporDonemi {
  return typeof deger === "string" &&
    (RAPOR_DONEMLERI as readonly string[]).includes(deger)
    ? (deger as RaporDonemi)
    : "buAy";
}

/** Dönemin [başlangıç, bitiş) aralığı; "tümü"de sınır yok. */
export function donemAraligi(donem: RaporDonemi): {
  baslangic?: Date;
  bitis?: Date;
} {
  const gun = bugun();
  const yil = gun.getUTCFullYear();
  const ay = gun.getUTCMonth();

  switch (donem) {
    case "buAy":
      return { baslangic: new Date(Date.UTC(yil, ay, 1)) };
    case "gecenAy":
      return {
        baslangic: new Date(Date.UTC(yil, ay - 1, 1)),
        bitis: new Date(Date.UTC(yil, ay, 1)),
      };
    case "son3Ay":
      return { baslangic: new Date(Date.UTC(yil, ay - 2, 1)) };
    default:
      return {};
  }
}

export type KaynakSatiri = {
  kaynak: LeadSource;
  toplam: number;
  kazanilan: number;
  kaybedilen: number;
  acik: number;
  /** Kazanılan / toplam, yüzde olarak yuvarlanmış. */
  oran: number;
};

export async function adayRaporu(subeId: string, donem: RaporDonemi) {
  const { baslangic, bitis } = donemAraligi(donem);

  const [satirlar, kayipSatirlari] = await Promise.all([
    db.lead.groupBy({
      by: ["source", "stage"],
      where: adayAralikKosulu(subeId, baslangic, bitis),
      _count: { _all: true },
    }),
    db.lead.groupBy({
      by: ["lossReason"],
      where: {
        ...adayAralikKosulu(subeId, baslangic, bitis),
        branchId: subeId,
        stage: "KAYBEDILDI",
      },
      _count: { _all: true },
    }),
  ]);

  const haritada = new Map<LeadSource, KaynakSatiri>();
  for (const satir of satirlar) {
    const mevcut = haritada.get(satir.source) ?? {
      kaynak: satir.source,
      toplam: 0,
      kazanilan: 0,
      kaybedilen: 0,
      acik: 0,
      oran: 0,
    };

    const adet = satir._count._all;
    mevcut.toplam += adet;
    if (satir.stage === "KAZANILDI") mevcut.kazanilan += adet;
    else if (satir.stage === "KAYBEDILDI") mevcut.kaybedilen += adet;
    else mevcut.acik += adet;

    haritada.set(satir.source, mevcut);
  }

  const kaynaklar = [...haritada.values()]
    .map((satir) => ({
      ...satir,
      oran:
        satir.toplam === 0
          ? 0
          : Math.round((satir.kazanilan / satir.toplam) * 100),
    }))
    // Çok aday getiren kaynak üstte: rapor "nereye bütçe gidiyor" sorusuna
    // yukarıdan aşağı okunarak cevap vermeli.
    .sort((a, b) => b.toplam - a.toplam);

  const kayipSebepleri = kayipSatirlari
    .filter(
      (satir): satir is typeof satir & { lossReason: LeadLossReason } =>
        satir.lossReason !== null,
    )
    .map((satir) => ({ sebep: satir.lossReason, adet: satir._count._all }))
    .sort((a, b) => b.adet - a.adet);

  const ozet = kaynaklar.reduce(
    (toplam, satir) => ({
      toplam: toplam.toplam + satir.toplam,
      kazanilan: toplam.kazanilan + satir.kazanilan,
      kaybedilen: toplam.kaybedilen + satir.kaybedilen,
    }),
    { toplam: 0, kazanilan: 0, kaybedilen: 0 },
  );

  return {
    kaynaklar,
    kayipSebepleri,
    ozet: {
      ...ozet,
      oran:
        ozet.toplam === 0
          ? 0
          : Math.round((ozet.kazanilan / ozet.toplam) * 100),
    },
  };
}
