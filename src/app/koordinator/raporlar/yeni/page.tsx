import { redirect } from "next/navigation";
import { yonetimZorunlu } from "@/lib/auth-guard";

/**
 * Eski "yeni rapor" adresi — öğrenci biliniyorsa profiline gidip rapor
 * penceresini açar, bilinmiyorsa öğrenci listesine düşürür.
 *
 * Rapor üretimi artık öğrenci profilindeki penceredeki "Yeni rapor oluştur"
 * düğmesiyle yapılıyor; bu rota yalnızca eski bağlantılar için duruyor.
 */
export default async function EskiYeniRaporAdresi(
  props: PageProps<"/koordinator/raporlar/yeni">,
) {
  await yonetimZorunlu();

  const parametreler = await props.searchParams;
  const ogrenciId =
    typeof parametreler.studentId === "string"
      ? parametreler.studentId
      : undefined;

  redirect(
    ogrenciId
      ? `/koordinator/ogrenciler/${ogrenciId}?rapor=yeni`
      : "/koordinator/ogrenciler",
  );
}
