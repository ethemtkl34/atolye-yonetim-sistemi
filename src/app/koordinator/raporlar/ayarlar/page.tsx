import type { Metadata } from "next";
import { Rozet, SayfaBasligi } from "@/components/ui";
import { raporAyariOku } from "@/lib/rapor-ayarlari";
import { tarihBicimle } from "@/lib/tarih";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { RaporAyarFormu } from "./ayar-formu";

export const metadata: Metadata = {
  title: "Rapor ayarları",
};

/**
 * §11.2 — Rapor eşikleri, kıyas kuralı ve kademe adları.
 *
 * `/koordinator/raporlar` kendisi öğrenci listesine yönleniyor (rapor
 * öğrenciye ait bir belge, ayrı liste tutulmuyor); bu alt adres o kuralın
 * istisnası değil, tamamlayıcısı: raporun NASIL üretileceği tek tek
 * öğrencilerin değil kurumun kararı.
 */
export default async function RaporAyarlariSayfasi() {
  await yonetimZorunlu("raporlar", "TAM");

  const ayar = await raporAyariOku();

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Rapor ayarları"
        aciklama="Öğrenci raporunun puanları kademeye çevirirken kullandığı ölçütler. Değişiklik yalnızca bundan sonra üretilecek raporlara işler: üretilmiş bir raporun içeriği donduruluyor, eskisini yeni ölçütlerle görmek için “güncel puanlarla yeniden üret” gerekir."
        ustBilgi={
          <Rozet tur="notr">
            {ayar.kayitliMi
              ? `Son güncelleme: ${tarihBicimle(ayar.guncellemeZamani!)}${ayar.guncelleyen ? ` · ${ayar.guncelleyen}` : ""}`
              : "Varsayılan değerler kullanılıyor"}
          </Rozet>
        }
      />

      <RaporAyarFormu ayar={ayar} />
    </div>
  );
}
