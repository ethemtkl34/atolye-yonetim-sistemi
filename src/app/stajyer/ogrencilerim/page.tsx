import type { Metadata } from "next";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { KayitListesi } from "@/components/puanlama-ekranlari";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";

export const metadata: Metadata = {
  title: "Öğrencilerim",
};

/**
 * §12.3 — Stajyere atanmış öğrenciler ve aktif kayıtları.
 *
 * §3.2 — Bu ekranda veli telefonu ve sağlık detayı yoktur; sorgu bu alanları
 * hiç okumaz. Öğrenci profiline bağlantı da verilmez, o ekran koordinatöre
 * aittir.
 */
export default async function OgrencilerimSayfasi() {
  const kullanici = await stajyerZorunlu();

  // Görevlerim ekranıyla aynı kapsam: arşivlenmiş veya tamamlanmış programın
  // kayıtları listelenmez.
  const ilerlemeler = await kayitIlerlemeleri({
    subeId: kullanici.aktifSubeId,
    internId: kullanici.id,
    yalnizcaAktif: true,
    yalnizcaAktifProgram: true,
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Öğrencilerim"
        aciklama="Size atanmış aktif kayıtlar. Puanlama günlerini görmek için öğrenciye tıklayın."
      />

      {ilerlemeler.length === 0 ? (
        <BosDurum
          baslik="Size atanmış aktif kayıt yok."
          aciklama="Koordinatör atama yaptığında öğrencileriniz burada listelenir."
        />
      ) : (
        <KayitListesi ilerlemeler={ilerlemeler} temelYol="/stajyer/puanlama" />
      )}
    </div>
  );
}
