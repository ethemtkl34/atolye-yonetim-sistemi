/**
 * Müfredat yardımcıları — bilerek bağımlılıksız (ne veritabanı ne React).
 *
 * Puanlama veri katmanı ve müfredat editörü aynı "hafta × atölye → konu"
 * eşlemesine ihtiyaç duyuyor; harita kurma ve sınır kontrolü burada tek
 * yerde durur ve veritabanı olmadan test edilir (`puan-hesaplari.ts` deseni).
 */

export type MufredatKonusu = {
  baslik: string;
  aciklama: string | null;
};

export type MufredatGirdisi = MufredatKonusu & {
  weekNumber: number;
  workshopTypeId: string;
};

/**
 * Hafta × atölye ikilisinin harita anahtarı. cuid'ler ":" içermediği için
 * bileşim çakışmasız.
 */
export function mufredatAnahtari(
  haftaNo: number,
  atolyeTipiId: string,
): string {
  return `${haftaNo}:${atolyeTipiId}`;
}

/** Girdi listesini `hafta:atölye → konu` haritasına çevirir. */
export function mufredatHaritasi(
  girdiler: readonly MufredatGirdisi[],
): Map<string, MufredatKonusu> {
  return new Map(
    girdiler.map((girdi) => [
      mufredatAnahtari(girdi.weekNumber, girdi.workshopTypeId),
      { baslik: girdi.baslik, aciklama: girdi.aciklama },
    ]),
  );
}

/**
 * Haritadan bir oturumun konusunu okur. Telafi günlerinin hafta numarası
 * yoktur (`Session.weekNumber = null`) — onlara bilerek konu dönmez: telafi
 * günü kaçırılan bir haftanın içeriğini tekrarlar, hangi haftanınki olduğu
 * oturumdan bilinemez.
 */
export function oturumKonusu(
  harita: ReadonlyMap<string, MufredatKonusu>,
  haftaNo: number | null,
  atolyeTipiId: string,
): MufredatKonusu | null {
  if (haftaNo === null) return null;
  return harita.get(mufredatAnahtari(haftaNo, atolyeTipiId)) ?? null;
}

/**
 * Hafta numarası programın takvimine sığıyor mu (1..toplam).
 *
 * Üst sınır programa göre değişken (dönemde hafta sayısı, kulüpte gün
 * sayısı); veritabanı CHECK'i yalnızca `>= 1` tarafını zorluyor.
 */
export function haftaAraliginda(haftaNo: number, toplamHafta: number): boolean {
  return Number.isInteger(haftaNo) && haftaNo >= 1 && haftaNo <= toplamHafta;
}
