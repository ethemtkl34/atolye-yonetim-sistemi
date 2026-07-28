import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { GunListesi, IlerlemeCubugu } from "@/components/puanlama-ekranlari";
import { kayitPuanlamasi } from "@/lib/puanlama-verisi";
import { grupZamani } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Kayıt puanlamaları",
};

/** §10.5 — Koordinatörün bir kaydın bütün puanlama günlerini görmesi. */
export default async function KoordinatorKayitPuanlamasi(
  props: PageProps<"/koordinator/puanlamalar/[kayitId]">,
) {
  await koordinatorZorunlu();
  const { kayitId } = await props.params;

  const veri = await kayitPuanlamasi(kayitId);
  if (!veri) notFound();

  const { kayit, gunler, ozet } = veri;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/puanlamalar"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Puanlamalar
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={kayit.ogrenciAdi}
            aciklama={`${kayit.program} · ${kayit.grupAdi} · ${grupZamani(kayit.gun, kayit.zamanDilimi)}`}
            aksiyon={
              <Link
                href={`/koordinator/ogrenciler/${kayit.ogrenciId}`}
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Öğrenci profili
              </Link>
            }
          />
        </div>
      </div>

      <Kart className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Puanlama durumu
            </h2>
            <Rozet>{kayit.programTuru}</Rozet>
            {kayit.aktif ? null : <Rozet tur="pasif">Kayıt iptal</Rozet>}
            <span className="text-sm text-zinc-500">
              Sorumlu stajyer: {kayit.stajyerAdi ?? "Atanmamış"}
            </span>
          </div>
          <div className="w-full sm:w-64">
            <IlerlemeCubugu ozet={ozet} />
          </div>
        </div>
      </Kart>

      <GunListesi
        gunler={gunler}
        temelYol={`/koordinator/puanlamalar/${kayit.id}`}
      />
    </div>
  );
}
