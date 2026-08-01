import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { SayfaBasligi } from "@/components/ui";
import { GunFormEkrani } from "@/components/puanlama-ekranlari";
import { kayitPuanlamasi } from "@/lib/puanlama-verisi";
import { tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Puanlama",
};

/**
 * §10.1 — Bir günün bütün atölye formları.
 *
 * Beş atölye alt alta, her biri kendi kaydet düğmesiyle. Böylece stajyer
 * yarım kalan bir günü sonradan tamamlayabilir; kaydedilen form beklemez.
 */
export default async function StajyerGunPuanlamasi(
  props: PageProps<"/stajyer/puanlama/[kayitId]/[tarih]">,
) {
  const kullanici = await stajyerZorunlu();
  const { kayitId, tarih } = await props.params;
  const parametreler = await props.searchParams;

  const veri = await kayitPuanlamasi(kayitId, kullanici.aktifSubeId);
  if (!veri || veri.kayit.stajyerId !== kullanici.id) notFound();

  const gun = veri.gunler.find((aday) => aday.tarihAnahtari === tarih);
  if (!gun) notFound();

  // Görevlerim'den gelen stajyer Görevlerim'e döner; kayıt sayfasından gelen
  // kayıt sayfasına. Tek sabit bağlantı ana akışta (görev listesi → form →
  // geri) kullanıcıyı hiç gelmediği bir ekrana götürüyordu.
  const gorevlerden = parametreler.geri === "gorevler";
  const geriBaglantisi = gorevlerden
    ? { href: "/stajyer", etiket: "← Görevlerim" }
    : {
        href: `/stajyer/puanlama/${kayitId}`,
        etiket: `← ${veri.kayit.ogrenciAdi} · puanlama günleri`,
      };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={geriBaglantisi.href}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          {geriBaglantisi.etiket}
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={tarihGunleBicimle(gun.tarih)}
            aciklama={`${veri.kayit.ogrenciAdi} · ${veri.kayit.program} · ${veri.kayit.grupAdi}`}
          />
        </div>
      </div>

      <GunFormEkrani
        kayit={veri.kayit}
        gun={gun}
        duzenlenebilir
        guvenlikUyarisiniGoster
      />
    </div>
  );
}
