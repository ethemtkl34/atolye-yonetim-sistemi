import { normalizeTelefon } from "@/lib/turkce";

/**
 * Telefon bağlantıları — aday kartındaki "Ara" ve "WhatsApp" düğmeleri için.
 *
 * `normalizeTelefon` arama/mükerrer eşleşmesi için gevşektir (kısmi numarayı
 * da kabul eder); bağlantı üretimi ise TAM numara ister — yarım numaraya
 * `tel:` bağlantısı vermek yanlış kişiyi aratır. Bu yüzden burada 10 haneli
 * (alan kodu + numara) Türkiye biçimi şart koşulur; sağlanamıyorsa null döner
 * ve arayüz düğme yerine düz metin gösterir.
 */

/** "0532 111 22 33" → "+905321112233"; tam numara değilse null. */
export function e164Telefon(telefon: string): string | null {
  const rakamlar = normalizeTelefon(telefon);
  if (rakamlar.length !== 10) return null;
  return `+90${rakamlar}`;
}

/** Telefon uygulamasını açan bağlantı; tam numara değilse null. */
export function telBaglantisi(telefon: string): string | null {
  const tam = e164Telefon(telefon);
  return tam ? `tel:${tam}` : null;
}

/**
 * WhatsApp sohbeti açan bağlantı; tam numara değilse null.
 * wa.me yalnız uluslararası biçimi kabul eder, "+" işareti olmadan.
 */
export function waBaglantisi(telefon: string): string | null {
  const tam = e164Telefon(telefon);
  return tam ? `https://wa.me/${tam.slice(1)}` : null;
}
