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
  // şube-muaf: oturumun sahibinin hâlâ aktif olup olmadığına bakılıyor.
  const kullanici = await db.user.findUnique({
    where: { id: oturum.user.id },
    select: { active: true },
  });
  if (kullanici?.active) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-marka-700 to-marka-900 p-6">
      <div className="kil-yuzey w-full max-w-sm p-6 text-center shadow-[16px_16px_40px_var(--kil-koyu-golge),-10px_-10px_26px_rgba(255,255,255,0.08),inset_0_1px_0_#fff]">
        <h1 className="text-lg font-bold tracking-tight text-zinc-900">
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
