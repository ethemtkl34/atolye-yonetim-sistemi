/**
 * §17.4 — Randevu indirimi YÜZDE olarak seçilir (Eylül 2026 revizyonu).
 *
 * Tutar yazmak hem yavaştı hem hata üretiyordu (₺3.200'ün %10'u elle
 * hesaplanıyordu). Oranlar eski CRM'de fiilen kullanılanlar: Kardeş %5,
 * kampanyalar %10 / %15 / %25 / %50. Veritabanında yine KURUŞ saklanır
 * (`Randevu.indirimKurus`) — ciro hesabı ve geçmiş kayıtlar değişmez; yüzde
 * yalnız giriş biçimi.
 *
 * Düzenlemede listede olmayan eski bir indirim (aktarılmış %18 gibi)
 * "mevcut" seçeneğiyle KORUNUR: formu açıp başka bir alanı değiştiren
 * kullanıcı indirimi farkında olmadan silmemeli.
 */

export const INDIRIM_YUZDELERI = [5, 10, 15, 25, 50] as const;

/** Formdaki seçim: yüzde ("0" = indirim yok) ya da düzenlemede eski tutarı koru. */
export const MEVCUT_INDIRIM = "mevcut";

/** Ücretin yüzdesi, kuruşa yuvarlanmış. */
export function yuzdeIndirimi(ucretKurus: number, yuzde: number): number {
  return Math.round((ucretKurus * yuzde) / 100);
}

/**
 * Kayıtlı indirim listedeki bir yüzdeye denk geliyor mu — düzenleme formunun
 * açılış değeri. İndirim yoksa 0; listedeki bir orana kuruşu kuruşuna
 * denkse o oran; değilse null (form "mevcut indirim"i gösterir).
 */
export function kayitliYuzde(ucretKurus: number, indirimKurus: number): number | null {
  if (indirimKurus === 0) return 0;
  return (
    INDIRIM_YUZDELERI.find((yuzde) => yuzdeIndirimi(ucretKurus, yuzde) === indirimKurus) ??
    null
  );
}

/** Seçim metnini çözer: izinli yüzde, "mevcut" ya da geçersiz (null). */
export function indirimSeciminiCoz(deger: string): number | typeof MEVCUT_INDIRIM | null {
  if (deger === MEVCUT_INDIRIM) return MEVCUT_INDIRIM;
  if (deger === "" || deger === "0") return 0;
  const sayi = Number(deger);
  return (INDIRIM_YUZDELERI as readonly number[]).includes(sayi) ? sayi : null;
}
