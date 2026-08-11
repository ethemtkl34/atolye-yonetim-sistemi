import type { Metadata } from "next";
import Link from "next/link";
import { stajyerZorunlu } from "@/lib/yetki-kapisi";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili } from "@/components/ui";
import { gelisimListesi } from "@/lib/gelisim-verisi";
import {
  DONEM_ETIKETLERI,
  GELISIM_DURUM_ETIKETLERI,
} from "@/lib/gelisim-degerlendirmesi";
import { tarihBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Gelişim testleri",
};

/**
 * Stajyerin gelişim testi görevleri: atanmış her dönem öğrencisi için dönem
 * ortası ve dönem sonu testlerinin durumu.
 *
 * §3.2 — Bu ekranda veli telefonu ve sağlık detayı yoktur; sorgu bu alanları
 * hiç okumaz.
 */
export default async function GelisimSayfasi() {
  const kullanici = await stajyerZorunlu();

  const kayitlar = await gelisimListesi({
    subeId: kullanici.aktifSubeId,
    internId: kullanici.id,
    yalnizcaAktif: true,
    yalnizcaAktifProgram: true,
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Gelişim testleri"
        aciklama="Sosyal Duygusal Bilişsel Beceriler testi her öğrenci için iki kez doldurulur: dönem ortasında ve dönem sonunda. Test, atölye puanlamasından bağımsızdır."
      />

      {kayitlar.length === 0 ? (
        <BosDurum
          baslik="Size atanmış aktif dönem kaydı yok."
          aciklama="Koordinatör atama yaptığında öğrencileriniz burada listelenir."
        />
      ) : (
        <div className="space-y-2">
          {kayitlar.map((kayit) => (
            <Kart key={kayit.kayitId} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-medium text-zinc-900">
                    {kayit.ogrenciAdi}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {kayit.program} · {kayit.grupAdi}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {kayit.noktalar.map((nokta) => {
                  const rozet = GELISIM_DURUM_ETIKETLERI[nokta.durum];

                  return (
                    <div
                      key={nokta.donem}
                      className="kil-oyuk flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-zinc-800">
                          {DONEM_ETIKETLERI[nokta.donem]}
                        </p>
                        <Rozet tur={rozet.rozet}>
                          {nokta.durum === "KILITLI" && nokta.pencere.acilisTarihi
                            ? `${rozet.etiket} · ${tarihBicimle(nokta.pencere.acilisTarihi)}`
                            : rozet.etiket}
                        </Rozet>
                      </div>

                      {nokta.durum === "KILITLI" ? null : (
                        <Link
                          href={`/stajyer/gelisim/${kayit.kayitId}/${nokta.donem}`}
                          className={baglantiStili}
                        >
                          {nokta.durum === "DOLDURULDU" ? "Görüntüle" : "Doldur"}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </Kart>
          ))}
        </div>
      )}
    </div>
  );
}
