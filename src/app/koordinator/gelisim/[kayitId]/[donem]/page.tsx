import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { GelisimFormu } from "@/components/gelisim-formu";
import { gelisimFormu } from "@/lib/gelisim-verisi";
import { DONEM_ETIKETLERI } from "@/lib/gelisim-degerlendirmesi";

export const metadata: Metadata = {
  title: "Gelişim testi",
};

/**
 * Koordinatörün gelişim testi formu — stajyerinkiyle aynı form ve aynı
 * eylem; fark yalnızca yetki kapısı (§10.5: koordinatör bütün kayıtları
 * doldurabilir ve düzeltebilir).
 */
export default async function KoordinatorGelisimFormu(
  props: PageProps<"/koordinator/gelisim/[kayitId]/[donem]">,
) {
  const kullanici = await yonetimZorunlu("puanlamalar", "TAM");
  const { kayitId, donem } = await props.params;

  if (donem !== "DONEM_ORTASI" && donem !== "DONEM_SONU") notFound();

  const veri = await gelisimFormu(kayitId, donem, kullanici.aktifSubeId);
  if (!veri) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${veri.ogrenciId}`}
          className={geriBaglantiStili}
        >
          ← {veri.ogrenciAdi}
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
