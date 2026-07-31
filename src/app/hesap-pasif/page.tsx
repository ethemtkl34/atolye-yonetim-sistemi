import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cikisYap } from "@/app/cikis/actions";
import { butonStili } from "@/components/ui";

export const metadata: Metadata = {
  title: "Hesap pasif",
};

/**
 * Pasife alınmış (veya silinmiş) hesapla gelen kullanıcının indiği sayfa.
 *
 * `girisZorunlu()` bu duruma düşen kullanıcıyı buraya yönlendirir; `/giris`'e
 * yönlendiremez çünkü proxy, oturum çerezi süren kullanıcıyı giriş sayfasından
 * kendi paneline geri gönderir ve döngü oluşur. Buradaki tek eylem oturumu
 * kapatmaktır — çerez temizlenince giriş ekranı yeniden erişilebilir olur.
 */
export default async function HesapPasifSayfasi() {
  const oturum = await auth();
  if (!oturum?.user?.id) redirect("/giris");

  // Hesap yeniden aktifleştirildiyse kullanıcı burada takılı kalmasın.
  const kullanici = await db.user.findUnique({
    where: { id: oturum.user.id },
    select: { active: true },
  });
  if (kullanici?.active) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-marka-800 p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg shadow-marka-900/20">
        <h1 className="text-lg font-semibold text-zinc-900">
          Hesabınız pasife alındı
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Bu hesapla artık işlem yapılamıyor. Bir yanlışlık olduğunu
          düşünüyorsanız kurum koordinatörüyle iletişime geçin.
        </p>
        <form action={cikisYap} className="mt-5">
          <button type="submit" className={butonStili("birincil", "w-full")}>
            Giriş ekranına dön
          </button>
        </form>
      </div>
    </main>
  );
}
