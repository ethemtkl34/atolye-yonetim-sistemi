"use client";

import { Kart, Rozet } from "@/components/ui";
import { KademeGostergesi, KademeYok } from "@/components/kademe-gostergesi";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";

/**
 * §11.2 — İkinci sürüm rapor gövdesinin pencere görünümü.
 *
 * PDF ile aynı bölümleri aynı sırayla gösterir: koordinatörün gördüğü ile
 * velinin eline geçen belge ayrışmamalı. Sayı burada da basılmıyor — PDF'te
 * gizlenip panelde gösterilseydi, koordinatör raporu farklı bir belge olarak
 * okurdu.
 */
export function RaporIcerigiV2({ govde }: { govde: RaporGovdesiV2 }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Rozet tur={govde.metinKaynagi === "ai" ? "olumlu" : "notr"}>
          {govde.metinKaynagi === "ai"
            ? "Gözlem metni yapay zekâ ile yazıldı"
            : "Gözlem metni yok"}
        </Rozet>
        {govde.ogrenci.sinif ? (
          <span className="text-xs text-zinc-500">
            Sınıf: {govde.ogrenci.sinif}
          </span>
        ) : null}
      </div>

      {govde.atolyeIcerikleri.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Atölyeler ve içerikleri</h3>
          {govde.atolyeIcerikleri.map((atolye) => (
            <Kart key={atolye.atolyeAdi} className="p-4">
              <h4 className="font-medium">{atolye.atolyeAdi}</h4>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                {atolye.metin}
              </p>
            </Kart>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Sosyal, duygusal ve bilişsel beceriler
        </h3>
        {govde.gelisimAlanlari.map((alan) => (
          <Kart key={alan.ad} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">{alan.ad}</h4>
              {alan.bant ? <KademeGostergesi bant={alan.bant} /> : <KademeYok />}
            </div>
            {alan.cumle ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                {alan.cumle}
              </p>
            ) : null}
          </Kart>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Atölyelerde ilgi ve başarı</h3>
        {govde.atolyeKademeleri.map((atolye) => (
          <Kart key={atolye.atolyeAdi} className="p-4">
            <h4 className="font-medium">{atolye.atolyeAdi}</h4>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-600">İlgi ve merak</span>
                {atolye.ilgi ? (
                  <KademeGostergesi bant={atolye.ilgi} />
                ) : (
                  <KademeYok />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-600">
                  Kazanımlara ulaşma
                </span>
                {atolye.basari ? (
                  <KademeGostergesi bant={atolye.basari} />
                ) : (
                  <KademeYok />
                )}
              </div>
            </div>
            {atolye.katilmadigiOturumSayisi > 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                {atolye.katilmadigiOturumSayisi} oturuma katılım sağlanmamış.
              </p>
            ) : null}
          </Kart>
        ))}

        {govde.asimetriler.map((asimetri) => (
          <Kart key={asimetri.atolyeAdi} className="bg-vurgu-50 p-3">
            <p className="text-sm text-vurgu-800">{asimetri.cumle}</p>
          </Kart>
        ))}
      </section>

      {govde.gozlem ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Gözlem raporu</h3>
          <Kart className="space-y-3 p-4 text-sm leading-relaxed text-zinc-700">
            <p>{govde.gozlem.giris}</p>
            <p>{govde.gozlem.profil}</p>

            {govde.gozlem.bloklar.map((blok) => (
              <div key={blok.beceriAdi} className="space-y-1">
                <h4 className="font-medium text-zinc-900">{blok.beceriAdi}</h4>
                {blok.tanim ? (
                  <p className="text-xs text-zinc-500">{blok.tanim}</p>
                ) : null}
                {blok.etkinlik ? <p>{blok.etkinlik}</p> : null}
                <p>{blok.gozlem}</p>
              </div>
            ))}

            <div className="space-y-1">
              <h4 className="font-medium text-zinc-900">Sonuç</h4>
              <p>{govde.gozlem.sonuc}</p>
            </div>

            <div className="space-y-1">
              <h4 className="font-medium text-zinc-900">
                Ev ortamında öneriler
              </h4>
              <p>{govde.gozlem.oneriler}</p>
              {govde.gozlem.urunler.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs text-zinc-600">
                  {govde.gozlem.urunler.map((urun) => (
                    <li key={urun.url}>{urun.ad}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Kart>
        </section>
      ) : (
        <Kart className="bg-yuzey-50 p-4">
          <p className="text-sm text-zinc-600">
            Gözlem bölümü üretilmedi. Bu bölüm yalnızca stajyerlerin puanlama
            formuna yazdığı gözlem notlarından üretilir; not yoksa yazılacak
            somut bir davranış da yoktur.
          </p>
        </Kart>
      )}
    </div>
  );
}
