import type { Metadata } from "next";
import { GirisFormu } from "./giris-formu";

export const metadata: Metadata = {
  title: "Giriş",
};

export default async function GirisSayfasi(
  props: PageProps<"/giris">,
) {
  // Next.js 16'da searchParams asenkron.
  const parametreler = await props.searchParams;
  const devam =
    typeof parametreler.devam === "string" ? parametreler.devam : undefined;

  return (
    // Giriş ekranı panelin tek tam renkli yüzeyi: kullanıcı sisteme kurumun
    // rengiyle karşılanıyor, çalışma ekranları ise okumayı zorlamamak için
    // açık kalıyor.
    <main className="flex flex-1 items-center justify-center bg-marka-800 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-white">
            Atölye Yönetim Sistemi
          </h1>
          <p className="mt-1 text-sm text-marka-200">
            Devam etmek için giriş yapın.
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg shadow-marka-900/20">
          <GirisFormu devam={devam} />
        </div>

        <p className="mt-6 text-center text-xs text-marka-200">
          Hesabınız yoksa kurum koordinatörüyle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
