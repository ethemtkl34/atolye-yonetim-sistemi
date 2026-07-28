import type { Metadata } from "next";
import { stajyerZorunlu } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Görevlerim",
};

/**
 * §12.3 — Stajyer ana ekranı. Atanmış öğrenciler ve puanlama görevleri
 * P7'de eklenecek.
 */
export default async function StajyerPaneli() {
  const kullanici = await stajyerZorunlu();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">
          Hoş geldiniz, {kullanici.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Size atanmış öğrenciler ve puanlama görevleri burada listelenecek.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
        <p className="text-sm text-zinc-600">
          Henüz size atanmış bir öğrenci yok.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Koordinatör kayıt oluşturup atama yaptığında görevleriniz burada
          görünecek.
        </p>
      </div>
    </div>
  );
}
