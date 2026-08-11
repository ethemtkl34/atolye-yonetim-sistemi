/**
 * Kurumun yürüttüğü terapi türleri — tek kaynak.
 *
 * Üç ayrı yerde ihtiyaç duyuluyordu ve üçü de kendi kopyasını taşıyordu:
 * ekleme formunun seçenekleri, satır/pencere etiketleri ve Danışmanlık
 * sayfasının adres süzgeci. Liste kurumun hizmet yelpazesiyle birlikte
 * değişiyor; tek yerde durması yeni tür eklerken üç dosyayı senkron tutma
 * yükünü kaldırır.
 *
 * SIRA ÖNEMLİ: form seçenekleri ve süzgeç bu diziyi olduğu gibi kullanır;
 * listedeki ilk tür formun varsayılanıdır.
 *
 * `deger` alanı veritabanındaki `TherapyType` enum'ıyla birebir aynı olmak
 * zorunda — buraya bir tür eklemek migration ister.
 */

export const TERAPI_TURLERI = [
  { deger: "OYUN_TERAPISI", slug: "oyun", etiket: "Oyun terapisi" },
  { deger: "ERGEN_TERAPISI", slug: "ergen", etiket: "Ergen terapisi" },
  { deger: "ERGOTERAPI", slug: "ergoterapi", etiket: "Ergoterapi" },
  { deger: "BILISSEL_MUDAHALE", slug: "bilissel", etiket: "Bilişsel müdahale" },
  {
    deger: "KISA_AILE_DANISMANLIGI",
    slug: "kisa-aile",
    etiket: "Kısa aile danışmanlığı",
  },
  {
    deger: "UZUN_AILE_DANISMANLIGI",
    slug: "uzun-aile",
    etiket: "Uzun aile danışmanlığı",
  },
] as const;

export type TerapiTuru = (typeof TERAPI_TURLERI)[number]["deger"];
export type TerapiTuruSlug = (typeof TERAPI_TURLERI)[number]["slug"];

export const TERAPI_TURU_ETIKETLERI = Object.fromEntries(
  TERAPI_TURLERI.map((tur) => [tur.deger, tur.etiket]),
) as Record<TerapiTuru, string>;

/** Adresteki slug → veritabanı enum değeri (Danışmanlık sayfası süzgeci). */
export const TERAPI_TURU_SLUGLARI = Object.fromEntries(
  TERAPI_TURLERI.map((tur) => [tur.slug, tur.deger]),
) as Record<TerapiTuruSlug, TerapiTuru>;

/** Adres parametresi geçerli bir tür slug'ı mı — süzgeç doğrulaması. */
export function terapiTuruSlugMu(deger: unknown): deger is TerapiTuruSlug {
  return (
    typeof deger === "string" &&
    Object.prototype.hasOwnProperty.call(TERAPI_TURU_SLUGLARI, deger)
  );
}
