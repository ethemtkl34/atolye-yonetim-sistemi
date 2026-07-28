import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { GunListesi, IlerlemeCubugu } from "@/components/puanlama-ekranlari";
import { kayitPuanlamasi } from "@/lib/puanlama-verisi";
import { grupZamani } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Puanlama günleri",
};

/**
 * §10.1 — Puanlama akışının ikinci adımı: öğrenci seçildi, şimdi gün seçilir.
 *
 * Stajyer yalnızca kendisine atanmış kaydı açabilir; başkasının kaydının
 * adresi yazıldığında sayfa bulunamadı döner (§3.2).
 */
export default async function StajyerKayitGunleri(
  props: PageProps<"/stajyer/puanlama/[kayitId]">,
) {
  const kullanici = await stajyerZorunlu();
  const { kayitId } = await props.params;

  const veri = await kayitPuanlamasi(kayitId);
  if (!veri || veri.kayit.stajyerId !== kullanici.id) notFound();

  const { kayit, gunler, ozet } = veri;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/stajyer/ogrencilerim"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Öğrencilerim
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={kayit.ogrenciAdi}
            aciklama={`${kayit.program} · ${kayit.grupAdi} · ${grupZamani(kayit.gun, kayit.zamanDilimi)}`}
          />
        </div>
      </div>

      {kayit.guvenlikUyarisi ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">Güvenlik uyarısı</p>
          <p className="mt-1 text-sm text-amber-900">{kayit.guvenlikUyarisi}</p>
        </div>
      ) : null}

      <Kart className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Puanlama durumu
            </h2>
            {!kayit.aktif ? <Rozet tur="pasif">Kayıt iptal</Rozet> : null}
          </div>
          <div className="w-full sm:w-64">
            <IlerlemeCubugu ozet={ozet} />
          </div>
        </div>
      </Kart>

      <GunListesi gunler={gunler} temelYol={`/stajyer/puanlama/${kayit.id}`} />
    </div>
  );
}
