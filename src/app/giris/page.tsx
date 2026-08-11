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
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-marka-700 to-marka-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Atölye Yönetim Sistemi
          </h1>
          <p className="mt-1 text-sm text-marka-200">
            Devam etmek için giriş yapın.
          </p>
        </div>

        {/* Koyu zeminden kabarmış kil plaka: panelin içindeki bütün kartlar
            da aynı malzemeden. */}
        <div className="kil-yuzey p-6 shadow-[16px_16px_40px_var(--kil-koyu-golge),-10px_-10px_26px_rgba(255,255,255,0.08),inset_0_1px_0_#fff]">
          <GirisFormu devam={devam} />
        </div>

        <p className="mt-6 text-center text-xs text-marka-200">
          Hesabınız yoksa kurum koordinatörüyle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
