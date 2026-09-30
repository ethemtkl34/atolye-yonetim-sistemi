import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";

/**
 * Eski rapor adresi — raporun sahibi öğrencinin sayfasına yönlendirir ve
 * rapor penceresini `?rapor=<id>` ile açtırır.
 *
 * Rapor detay sayfası kaldırıldı (içerik artık öğrenci profilindeki
 * pencerede) ama adres yaşamaya devam ediyor: dashboard'daki "Aç"
 * bağlantıları ve daha önce paylaşılmış rapor adresleri kırılmasın diye.
 */
export default async function EskiRaporAdresi(
  props: PageProps<"/koordinator/raporlar/[id]">,
) {
  await yonetimZorunlu("raporlar");
  const { id } = await props.params;

  // Öğrenciler iki şubede ortak havuzda (Eylül 2026) — şube süzgeci yok.
  const rapor = await db.report.findFirst({
    where: { id },
    select: { studentId: true },
  });

  if (!rapor) notFound();

  redirect(`/koordinator/ogrenciler/${rapor.studentId}?rapor=${id}`);
}
