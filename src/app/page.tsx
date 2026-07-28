import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { anaSayfaYolu } from "@/lib/auth-guard";

/**
 * Kök adres tek başına bir sayfa değil, yönlendirme noktası: kullanıcı
 * rolüne ait panele, oturum yoksa giriş ekranına gider.
 */
export default async function AnaSayfa() {
  const oturum = await auth();

  if (!oturum?.user) {
    redirect("/giris");
  }

  redirect(anaSayfaYolu(oturum.user.role));
}
