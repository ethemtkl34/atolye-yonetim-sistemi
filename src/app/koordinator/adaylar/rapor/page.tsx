import type { Metadata } from "next";
import Link from "next/link";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import {
  BosDurum,
  Kart,
  KatlanirBolum,
  SayfaBasligi,
  geriBaglantiStili,
} from "@/components/ui";
import { DurumOgesi } from "@/app/koordinator/dashboard-kartlari";
import { ADAY_KAYIP_SEBEPLERI, ADAY_KAYNAKLARI } from "@/lib/aday-durumlari";
import {
  DONEM_ETIKETLERI,
  RAPOR_DONEMLERI,
  adayRaporu,
  raporDonemiCoz,
} from "@/lib/aday/aday-raporu";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";

export const metadata: Metadata = {
  title: "Aday raporu",
};

const TEMEL_YOL = "/koordinator/adaylar/rapor";

/**
 * §16.7 — Kaynak bazlı dönüşüm raporu.
 *
 * Grafik kütüphanesi YOK: oran, puanlama ekranındaki ilerleme çubuğunun aynısı
 * (gömük yuva + dolgu). Yığılmış çok renkli çubuk denenmedi çünkü açıklama
 * (legend) gerektirir ve sayılar zaten satırda yazılı.
 */
export default async function AdayRaporuSayfasi(
  props: PageProps<"/koordinator/adaylar/rapor">,
) {
  const kullanici = await yonetimZorunlu("adaylar");
  const parametreler = await props.searchParams;
  const donem = raporDonemiCoz(parametreler.donem);

  const { kaynaklar, kayipSebepleri, ozet } = await adayRaporu(
    kullanici.aktifSubeId,
    donem,
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/koordinator/adaylar" className={geriBaglantiStili}>
          ← Adaylar
        </Link>
      </div>

      <SayfaBasligi
        baslik="Aday raporu"
        aciklama="Adaylar GELDİKLERİ tarihe göre sayılır: “bu ay gelen adayların kaçı kazanıldı”. Kazanılma tarihi ayrı bir sorudur."
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Dönem"
          temelYol={TEMEL_YOL}
          anahtar="donem"
          secenekler={RAPOR_DONEMLERI.map((deger) => ({
            deger,
            etiket: DONEM_ETIKETLERI[deger],
          }))}
          secili={donem}
        />
      </SuzgecCubugu>

      {ozet.toplam === 0 ? (
        <BosDurum
          baslik="Bu dönemde aday kaydı yok."
          aciklama="Başka bir dönem seçin ya da aday eklemeye başlayın."
        />
      ) : (
        <>
          <Kart className="grid grid-cols-2 divide-y divide-yuzey-100 sm:grid-cols-4 sm:divide-y-0">
            <DurumOgesi baslik="Toplam aday" deger={ozet.toplam} />
            <DurumOgesi baslik="Kazanılan" deger={ozet.kazanilan} />
            <DurumOgesi baslik="Kaybedilen" deger={ozet.kaybedilen} />
            <DurumOgesi baslik="Dönüşüm (%)" deger={ozet.oran} />
          </Kart>

          <Kart className="kil-bolmeli">
            {kaynaklar.map((satir) => (
              <div key={satir.kaynak} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-900">
                    {ADAY_KAYNAKLARI[satir.kaynak]}
                  </span>
                  <span className="text-sm text-zinc-600 tabular-nums">
                    {satir.toplam} aday · {satir.kazanilan} kazanıldı ·{" "}
                    <span className="font-semibold">%{satir.oran}</span>
                  </span>
                </div>

                {/* Puanlama ekranındaki `IlerlemeCubugu` ile aynı dil:
                    gömük yuva + dolgu. Dolgu dönüşüm oranı. */}
                <div className="kil-yuva mt-2 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${satir.oran}%` }}
                  />
                </div>

                <p className="mt-1.5 text-xs text-zinc-500">
                  {satir.acik} açık · {satir.kaybedilen} kaybedildi
                </p>
              </div>
            ))}
          </Kart>

          {kayipSebepleri.length > 0 ? (
            <KatlanirBolum
              baslik="Kayıp sebepleri"
              etiket={
                <span className="text-sm font-normal text-zinc-500">
                  {ozet.kaybedilen} aday
                </span>
              }
            >
              <div className="space-y-3">
                {kayipSebepleri.map((satir) => {
                  const yuzde =
                    ozet.kaybedilen === 0
                      ? 0
                      : Math.round((satir.adet / ozet.kaybedilen) * 100);

                  return (
                    <div key={satir.sebep}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-zinc-700">
                          {ADAY_KAYIP_SEBEPLERI[satir.sebep]}
                        </span>
                        <span className="text-zinc-500 tabular-nums">
                          {satir.adet} (%{yuzde})
                        </span>
                      </div>
                      <div className="kil-yuva mt-1 h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full bg-zinc-400"
                          style={{ width: `${yuzde}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </KatlanirBolum>
          ) : null}
        </>
      )}
    </div>
  );
}
