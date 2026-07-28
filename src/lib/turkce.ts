/**
 * Türkçe metin yardımcıları.
 *
 * Arama ve sıralamada Türkçe'ye özgü iki tuzak var:
 *  1. `I/ı` ve `İ/i` çiftleri — varsayılan `toLowerCase()` bunları yanlış eşler.
 *     ("İSTANBUL".toLowerCase() → "i̇stanbul", araya birleşik nokta girer.)
 *  2. Sıralamada `ç, ğ, ı, ö, ş, ü` harflerinin alfabedeki gerçek yeri.
 *
 * Bu dosya her iki durumu da tek noktadan çözer; arama ve sıralama yapan
 * her yer buradan okur, ikinci bir kopyası yazılmaz.
 */

const ARAMA_KARSILIKLARI: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/**
 * Metni arama için normalize eder: Türkçe küçük harfe çevirir, aksanlı
 * harfleri sade karşılıklarına indirger, fazla boşlukları temizler.
 *
 * Amaç aramanın bağışlayıcı olması: "sule", "Şule", "ŞULE" ve "şule"
 * aynı sonuca ulaşmalıdır.
 *
 *   normalizeArama("Şule ÇINAR") === "sule cinar"
 *   normalizeArama("İpek")       === "ipek"
 */
export function normalizeArama(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (harf) => ARAMA_KARSILIKLARI[harf] ?? harf)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Telefon numarasını yalnızca rakamlara indirger; böylece "0532 111 22 33",
 * "05321112233" ve "+90 532 111 22 33" aynı numara olarak aranabilir.
 * Ülke kodu (90) baştaysa atılır, 11 haneli 0'lı biçim 10 haneye indirilir.
 */
export function normalizeTelefon(telefon: string): string {
  let rakamlar = telefon.replace(/\D/g, "");
  if (rakamlar.startsWith("90") && rakamlar.length === 12) {
    rakamlar = rakamlar.slice(2);
  }
  if (rakamlar.startsWith("0") && rakamlar.length === 11) {
    rakamlar = rakamlar.slice(1);
  }
  return rakamlar;
}

/** Türkçe alfabe sırasına göre karşılaştırır. Array.sort() ile kullanılır. */
export function turkceKarsilastir(a: string, b: string): number {
  return a.localeCompare(b, "tr-TR");
}

/** Ad ve soyadı tek bir görüntülenebilir isme birleştirir. */
export function tamAd(ad: string, soyad: string): string {
  return `${ad} ${soyad}`.trim();
}
