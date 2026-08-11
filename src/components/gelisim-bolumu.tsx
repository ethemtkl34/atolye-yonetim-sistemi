import Link from "next/link";
import { KatlanirBolum, Rozet, baglantiStili } from "@/components/ui";
import {
  DONEM_ETIKETLERI,
  GELISIM_DURUM_ETIKETLERI,
} from "@/lib/gelisim-degerlendirmesi";
import type { GelisimKaydi } from "@/lib/gelisim-verisi";
import { tarihBicimle } from "@/lib/tarih";

/**
 * Öğrenci profilindeki gelişim testi bölümü.
 *
 * Cevaplar burada tekrar çizilmez; "Görüntüle / Doldur" bağlantısı
 * koordinatör form sayfasına gider — form hem okuma hem düzeltme yeri
 * (§10.5: koordinatör bütün kayıtları düzeltebilir).
 */
export function GelisimBolumu({ kayitlar }: { kayitlar: GelisimKaydi[] }) {
  const doldurulan = kayitlar
    .flatMap((kayit) => kayit.noktalar)
    .filter((nokta) => nokta.durum === "DOLDURULDU").length;

  return (
    <KatlanirBolum
      baslik="Gelişim testleri"
      etiket={
        kayitlar.length > 0 ? (
          <Rozet tur={doldurulan > 0 ? "olumlu" : "notr"}>
            {doldurulan} dolduruldu
          </Rozet>
        ) : undefined
      }
    >
      {kayitlar.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Bu öğrencinin dönem kaydı yok; gelişim testi yalnızca dönem
          öğrencileri için doldurulur.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Sosyal Duygusal Bilişsel Beceriler testi; stajyer tarafından dönem
            ortasında ve dönem sonunda doldurulur.
          </p>

          {kayitlar.map((kayit) => (
            // Kaydın kutusu gömük bir tepsi; içindeki dönem hücreleri düz
            // durur. Tepsinin içine ikinci bir yüzey konulursa iki kutu iç
            // içe geçmiş gibi okunuyor.
            <div key={kayit.kayitId} className="kil-oyuk p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900">
                  {kayit.program} · {kayit.grupAdi}
                </p>
                {kayit.aktif ? null : <Rozet tur="pasif">İptal kayıt</Rozet>}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {kayit.noktalar.map((nokta) => {
                  const rozet = GELISIM_DURUM_ETIKETLERI[nokta.durum];

                  return (
                    <div
                      key={nokta.donem}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-zinc-800">
                          {DONEM_ETIKETLERI[nokta.donem]}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <Rozet tur={rozet.rozet}>
                            {nokta.durum === "KILITLI" &&
                            nokta.pencere.acilisTarihi
                              ? `${rozet.etiket} · ${tarihBicimle(nokta.pencere.acilisTarihi)}`
                              : rozet.etiket}
                          </Rozet>
                          {nokta.dolduran ? (
                            <span className="text-xs text-zinc-500">
                              {nokta.dolduran}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {nokta.durum === "KILITLI" ? null : (
                        <Link
                          href={`/koordinator/gelisim/${kayit.kayitId}/${nokta.donem}`}
                          className={baglantiStili}
                        >
                          {nokta.durum === "DOLDURULDU"
                            ? "Görüntüle"
                            : "Doldur"}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </KatlanirBolum>
  );
}
