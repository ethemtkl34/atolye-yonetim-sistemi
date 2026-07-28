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
  day: z.enum(["CUMARTESI", "PAZAR"], { message: "Gün seçin" }),
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
