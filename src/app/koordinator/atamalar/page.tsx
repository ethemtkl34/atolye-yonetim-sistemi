import { redirect } from "next/navigation";

/**
 * Stajyer atamaları ekranı kaldırıldı — atama artık iki doğal yerinde:
 * stajyerin kendi sayfasında (program seç, öğrencileri ata) ve öğrenci
 * profilinde (kaydın sorumlusunu seç).
 *
 * Rota yönlendirme olarak duruyor: dashboard kartı, öğrenci profilindeki
 * eski bağlantı ve kayıtlı adresler 404 görmesin diye.
 */
export default function AtamalarSayfasi() {
  redirect("/koordinator/stajyerler");
}
