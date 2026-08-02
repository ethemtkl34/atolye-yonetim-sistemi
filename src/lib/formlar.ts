import { z } from "zod";

/**
 * Form doğrulamasının paylaşılan parçaları.
 *
 * Grup şeması dönem ve kulüp tarafında birebir aynı (§2.3): grup her iki
 * programda da ad, gün, zaman dilimi ve kontenjanla tanımlanır. İki kopya
 * tutulsaydı biri güncellenip diğeri unutulabilirdi.
 */

export const GRUP_SEMASI = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Grup adı gerekli")
    .max(60, "Grup adı en fazla 60 karakter olabilir"),
  /**
   * Grup haftada birden çok gün toplanabilir; formdan çoklu kutu geliyor.
   * Hangi günlerin sunulacağını dönemin `dayMode` alanı belirliyor, ama şema
   * yedi günün hepsini kabul ediyor: kısıt sunucuda dönem okunduktan sonra
   * uygulanıyor (formdan gelen değere güvenilmez).
   */
  days: z
    .array(
      z.enum([
        "PAZARTESI",
        "SALI",
        "CARSAMBA",
        "PERSEMBE",
        "CUMA",
        "CUMARTESI",
        "PAZAR",
      ]),
    )
    .min(1, "En az bir gün seçin"),
  timeSlot: z.enum(["OGLEDEN_ONCE", "OGLEDEN_SONRA"], {
    message: "Zaman dilimi seçin",
  }),
  capacity: z.coerce
    .number()
    .int("Kontenjan tam sayı olmalı")
    .min(1, "Kontenjan en az 1 olmalı")
    .max(200, "Kontenjan en fazla 200 olabilir"),
});

/** Zod hatalarını `alan → mesaj` sözlüğüne çevirir; ilk hata korunur. */
export function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path.join(".");
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message;
  }
  return sonuc;
}

/**
 * Formdan gelen metin alanlarını olduğu gibi geri döndürür.
 *
 * React 19, form eylemi tamamlanınca kontrolsüz alanları sıfırlıyor — eylem
 * doğrulama hatasıyla dönse bile. Kullanıcının yazdıklarının kaybolmaması
 * için eylem, hatayla birlikte girilen değerleri de döndürür; form bunları
 * `defaultValue` olarak kullanır (React, `useActionState` güncellemesiyle
 * sıfırlamayı aynı işleme aldığı için yeni defaultValue alanlara yansır).
 */
export function formDegerleri(
  formVerisi: FormData,
  alanlar: readonly string[],
): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const alan of alanlar) {
    const deger = formVerisi.get(alan);
    if (typeof deger === "string") sonuc[alan] = deger;
  }
  return sonuc;
}
