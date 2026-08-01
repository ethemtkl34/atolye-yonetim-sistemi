import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";

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
  await koordinatorZorunlu();
  const { id } = await props.params;

  const rapor = await db.report.findUnique({
    where: { id },
    select: { studentId: true },
  });

  if (!rapor) notFound();

  redirect(`/koordinator/ogrenciler/${rapor.studentId}?rapor=${id}`);
}
