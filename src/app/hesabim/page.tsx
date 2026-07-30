import type { Metadata } from "next";
import Link from "next/link";
import { girisZorunlu, rolAdi, anaSayfaYolu } from "@/lib/auth-guard";
import { Kart, SayfaBasligi } from "@/components/ui";
import { ParolaFormu } from "./parola-formu";

export const metadata: Metadata = {
  title: "Hesabım",
};

/**
 * Kullanıcının kendi hesabı.
 *
 * Hem koordinatör hem stajyer aynı sayfayı kullanıyor: yapılan tek iş kendi
 * parolasını değiştirmek ve bu ikisi için de aynı. Panel kabuğunun dışında
 * (`/hesabim`) duruyor çünkü iki panelin de kendi yerleşimi var ve sayfa
 * ikisine de ait değil.
 */
export default async function HesabimSayfasi() {
  const kullanici = await girisZorunlu();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-6">
      <Link
        href={anaSayfaYolu(kullanici.role)}
        className="text-sm text-zinc-500 hover:text-marka-700"
      >
        ← Panele dön
      </Link>

      <div className="mt-2">
        <SayfaBasligi
          baslik="Hesabım"
          aciklama="Parolanızı buradan değiştirebilirsiniz."
        />
      </div>

      <Kart className="mt-6 p-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-zinc-500">Ad</dt>
            <dd className="mt-0.5 text-sm text-zinc-800">{kullanici.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Rol</dt>
            <dd className="mt-0.5 text-sm text-zinc-800">
              {rolAdi(kullanici.role)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-zinc-500">Kullanıcı adı</dt>
            <dd className="mt-0.5 text-sm text-zinc-800">{kullanici.email}</dd>
          </div>
        </dl>
      </Kart>

      <Kart className="mt-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Parola değiştir
        </h2>
        <div className="mt-3">
          <ParolaFormu />
        </div>
      </Kart>
    </main>
  );
}
