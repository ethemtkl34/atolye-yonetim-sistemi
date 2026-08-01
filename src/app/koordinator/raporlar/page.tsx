import { redirect } from "next/navigation";

/**
 * Raporlar listesi kaldırıldı — raporlar artık öğrencinin kendi sayfasında.
 *
 * Rota bir yönlendirme olarak duruyor, silinmiyor: dashboard'daki rapor
 * kartları, kayıtlı yer imleri ve paylaşılmış adresler 404 görmek yerine
 * öğrenci listesine düşüyor. Rapor "bütün raporlar" değil, "bu öğrencinin
 * raporu" olarak ele alındığı için doğal giriş noktası öğrenci profili.
 */
export default function RaporlarSayfasi() {
  redirect("/koordinator/ogrenciler");
}
