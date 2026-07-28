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
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            Atölye Yönetim Sistemi
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Devam etmek için giriş yapın.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <GirisFormu devam={devam} />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Hesabınız yoksa kurum koordinatörüyle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
