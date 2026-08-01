import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { GunFormEkrani } from "@/components/puanlama-ekranlari";
import { kayitPuanlamasi } from "@/lib/puanlama-verisi";
import { tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Puanlama düzenle",
};

/**
 * §10.5 — Koordinatör her puanlamayı düzenleyebilir.
 *
 * Stajyerin gördüğü formun aynısı gösterilir; ayrı bir "yönetici formu"
 * yazılmadı ki iki taraf aynı kuralları ve aynı ölçeği görsün.
 */
export default async function KoordinatorGunPuanlamasi(
  props: PageProps<"/koordinator/puanlamalar/[kayitId]/[tarih]">,
) {
  const kullanici = await yonetimZorunlu();
  const { kayitId, tarih } = await props.params;

  const veri = await kayitPuanlamasi(kayitId, kullanici.aktifSubeId);
  if (!veri) notFound();

  const gun = veri.gunler.find((aday) => aday.tarihAnahtari === tarih);
  if (!gun) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/puanlamalar/${kayitId}`}
          className={geriBaglantiStili}
        >
          ← {veri.kayit.ogrenciAdi} · puanlama günleri
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={tarihGunleBicimle(gun.tarih)}
            aciklama={`${veri.kayit.ogrenciAdi} · ${veri.kayit.program} · ${veri.kayit.grupAdi} · Sorumlu stajyer: ${veri.kayit.stajyerAdi ?? "Atanmamış"}`}
          />
        </div>
      </div>

      <GunFormEkrani
        kayit={veri.kayit}
        gun={gun}
        duzenlenebilir
        guvenlikUyarisiniGoster={false}
      />
    </div>
  );
}
