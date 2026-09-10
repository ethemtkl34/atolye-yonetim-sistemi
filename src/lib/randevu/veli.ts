import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { db } from "@/lib/db";

/** Randevu için kayıtlı veliyi doğrular ya da aday bilgisinden oluşturur. */
export async function veliyiCoz(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  args: { subeId: string; veliId: string | null; ad: string | null; telefon: string | null },
): Promise<string | { hata: string }> {
  if (args.veliId) {
    const veli = await tx.veli.findFirst({ where: { id: args.veliId, branchId: args.subeId }, select: { id: true } });
    return veli ? veli.id : { hata: "Seçilen veli bu şubede bulunamadı." };
  }
  if (!args.ad) return { hata: "Veli adı gerekli." };
  const searchPhone = args.telefon ? normalizeTelefon(args.telefon) : null;
  const searchName = normalizeArama(args.ad);
  const eslesen = searchPhone
    ? await tx.veli.findFirst({ where: { branchId: args.subeId, searchPhone, searchName }, select: { id: true } })
    : null;
  if (eslesen) return eslesen.id;
  const yeni = await tx.veli.create({ data: { branchId: args.subeId, fullName: args.ad, phone: args.telefon, searchPhone, searchName }, select: { id: true } });
  return yeni.id;
}
