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
 * Telefon numarasını karşılaştırılabilir biçime indirger: yalnızca rakamlar,
 * ülke kodu ve baştaki sıfır atılmış hâlde. Böylece "0532 111 22 33",
 * "05321112233" ve "+90 532 111 22 33" aynı numara olarak eşleşir.
 *
 * Baştaki sıfır uzunluğa bakılmaksızın atılır. Bu, kısmi arama için önemli:
 * koordinatör numarayı hatırladığı kadarıyla "0532" diye yazdığında da
 * eşleşme bulunabilmeli. Sıfır zaten şehirlerarası önek, numaranın anlamlı
 * kısmına dahil değil.
 *
 *   normalizeTelefon("0532 111 22 33")   === "5321112233"
 *   normalizeTelefon("+90 532 111 22 33") === "5321112233"
 *   normalizeTelefon("0532")              === "532"
 */
export function normalizeTelefon(telefon: string): string {
  let rakamlar = telefon.replace(/\D/g, "");

  // Uluslararası arama öneki: 00 90 532...
  if (rakamlar.startsWith("00")) {
    rakamlar = rakamlar.slice(2);
  }

  // Ülke kodu yalnızca tam numara uzunluğundayken atılır; "90" kısa bir
  // parça olarak yazılmışsa numaranın kendisinden bir kesit olabilir.
  if (rakamlar.startsWith("90") && rakamlar.length > 10) {
    rakamlar = rakamlar.slice(2);
  }

  if (rakamlar.startsWith("0")) {
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
