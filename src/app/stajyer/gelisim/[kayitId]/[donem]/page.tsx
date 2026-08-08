import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stajyerZorunlu } from "@/lib/yetki-kapisi";
import { SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { GelisimFormu } from "@/components/gelisim-formu";
import { gelisimFormu } from "@/lib/gelisim-verisi";
import { DONEM_ETIKETLERI } from "@/lib/gelisim-degerlendirmesi";

export const metadata: Metadata = {
  title: "Gelişim testi",
};

/** Stajyerin gelişim testi formu — tek kayıt, tek dönem noktası. */
export default async function StajyerGelisimFormu(
  props: PageProps<"/stajyer/gelisim/[kayitId]/[donem]">,
) {
  const kullanici = await stajyerZorunlu();
  const { kayitId, donem } = await props.params;

  if (donem !== "DONEM_ORTASI" && donem !== "DONEM_SONU") notFound();

  const veri = await gelisimFormu(kayitId, donem, kullanici.aktifSubeId);
  // §3.2 — Stajyer yalnızca kendisine atanmış kaydı görür.
  if (!veri || veri.internId !== kullanici.id) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/stajyer/gelisim" className={geriBaglantiStili}>
          ← Gelişim testleri
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={`${veri.ogrenciAdi} — ${DONEM_ETIKETLERI[donem]}`}
            aciklama={`${veri.program} · ${veri.grupAdi}`}
          />
        </div>
      </div>

      <GelisimFormu veri={veri} duzenlenebilir />
    </div>
  );
}
