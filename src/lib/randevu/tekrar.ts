/**
 * §17.4 — Haftalık tekrar.
 *
 * Belge: "Düzenli danışmanlık seansları bir sonraki hafta aynı gün ve saate
 * otomatik olarak eklenmeli… Her danışanın sabit bir seans saati olduğundan
 * bu özellik iş yükünü azaltır."
 *
 * KARAR — tek "bir sonraki" değil, HAFTA SAYISI SEÇİLEN BİR SERİ.
 * Gerekçe: tek bir sonraki randevu ancak her hafta yeniden tetiklenirse iş
 * yükünü azaltır ve o tetiği çalıştıracak bir zamanlayıcı yok. Ufku belli bir
 * seri aynı faydayı veriyor, üstüne takvimde görünüyor (kontenjan ve doluluk
 * ancak böyle okunuyor) ve geri alınabiliyor. Hafta sayısı 1 seçilirse
 * belgenin harfi harfine istediği davranış çıkar.
 *
 * Tekrar YALNIZ `Hizmet.tekrarli` işaretli hizmetlerde açılır; zekâ testleri
 * bu otomasyonun dışında ve her seferinde elle girilir.
 *
 * SAF: veritabanına gitmiyor, yalnız tarih üretiyor. Çakışma kontrolü çağıran
 * tarafta, üretilen her tarih için ayrı ayrı yapılır (bkz. `cakisma.ts`).
 */

/** Varsayılan seri uzunluğu — bir dönemin kabaca yarısı. */
export const VARSAYILAN_TEKRAR_HAFTASI = 8;

/** Tek randevu = tekrar yok. */
export const EN_AZ_TEKRAR_HAFTASI = 1;

/**
 * Üst sınır yarım yıl. Daha uzunu pratikte planlanmıyor ve kazara 200 hafta
 * seçilmesi takvimi tek danışanla dolduran 200 satır üretirdi (dönem
 * sihirbazındaki `EN_FAZLA_HAFTA` ile aynı gerekçe).
 */
export const EN_FAZLA_TEKRAR_HAFTASI = 26;

const HAFTA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Serinin başlangıç saatleri.
 *
 * İlk eleman randevunun kendisi; sonrakiler tam yedi gün aralıklı. Gün ve
 * saat korunur çünkü hesap milisaniye üzerinden yapılıyor ve tarihler duvar
 * saati olarak UTC'de saklanıyor (bkz. Randevu şema şerhi) — yaz saati
 * geçişinde seans saati kaymaz. Gerçek saat dilimiyle çalışılsaydı ekim
 * ayındaki bir seri kasımda bir saat kayardı.
 */
export function tekrarTarihleri(
  ilkBaslangic: Date,
  haftaSayisi: number,
): Date[] {
  const sayi = Math.min(
    Math.max(Math.trunc(haftaSayisi), EN_AZ_TEKRAR_HAFTASI),
    EN_FAZLA_TEKRAR_HAFTASI,
  );

  return Array.from(
    { length: sayi },
    (_, sira) => new Date(ilkBaslangic.getTime() + sira * HAFTA_MS),
  );
}

export type TekrarKapsami = "yalniz-bu" | "bu-ve-sonrakiler";

/**
 * Bir seride, verilen kapsama giren randevuların hangileri olduğu.
 *
 * "Bundan sonrakiler" GEÇMİŞE DOKUNMAZ: seçilen randevudan önce gelenler
 * yapılmış seanslardır ve iptal edilemez. Kapsam tarihe göre belirleniyor,
 * satır sırasına göre değil — araya elle eklenen bir telafi randevusu da
 * doğru tarafta kalsın.
 */
export function kapsamdakiRandevular<T extends { id: string; baslangic: Date }>(
  hepsi: readonly T[],
  secilen: { id: string; baslangic: Date },
  kapsam: TekrarKapsami,
): T[] {
  if (kapsam === "yalniz-bu") {
    return hepsi.filter((randevu) => randevu.id === secilen.id);
  }

  return hepsi.filter(
    (randevu) =>
      randevu.id === secilen.id ||
      randevu.baslangic.getTime() > secilen.baslangic.getTime(),
  );
}
