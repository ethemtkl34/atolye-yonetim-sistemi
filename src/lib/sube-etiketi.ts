/**
 * Öğrencinin (ve velinin) kayıt şubesi etiketini yazıya çevirir.
 *
 * Ortak havuzda (Eylül 2026) `Student.branchId` yalnız etiket ve BOŞ
 * olabilir: eski arşivden gelen öğrencilerin şubesi bilinmiyor. Ekranlar
 * boş etiketi hep aynı sözcükle göstersin diye tek yerde.
 */

export const SUBESIZ = "Şubesiz";

/** Formlardaki ve süzgeçteki "Şubesiz" seçeneğinin değeri. */
export const SUBESIZ_DEGERI = "yok";

export function subeEtiketi(sube: { name: string } | null | undefined): string {
  return sube?.name ?? SUBESIZ;
}

/**
 * Seçicilerdeki öğrenci adı: çalışılan şubenin öğrencisi yalın, diğerleri
 * (başka şube ya da şubesiz) parantez içinde etiketiyle.
 */
export function adVeSube(
  ad: string,
  ogrenci: { branchId: string | null; branch: { name: string } | null },
  calisilanSubeId: string,
): string {
  return ogrenci.branchId === calisilanSubeId
    ? ad
    : `${ad} (${subeEtiketi(ogrenci.branch)})`;
}
