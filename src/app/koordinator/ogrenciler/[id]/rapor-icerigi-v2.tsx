"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, CokSatirli, DonenHalka, Rozet } from "@/components/ui";
import { KademeGostergesi, KademeYok } from "@/components/kademe-gostergesi";
import { cn } from "@/lib/utils";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";
import { raporBolumunuDuzenle, type DuzenlenebilirAlan } from "./rapor-eylemleri";

/**
 * §11.2 — İkinci sürüm rapor gövdesinin pencere görünümü.
 *
 * PDF ile aynı bölümleri aynı sırayla gösterir: koordinatörün gördüğü ile
 * velinin eline geçen belge ayrışmamalı.
 *
 * DÜZENLEME: veliye giden her metin kutusunun sağ üstünde kalem var;
 * tıklanınca kutu yerinde düzenleyiciye dönüşür ve yalnızca o metin
 * kaydedilir. Eski "tüm raporu tek formda düzenle" ekranı v2 raporlarda
 * kullanılmıyor. `raporId` verilmezse görünüm salt okunurdur.
 */
export function RaporIcerigiV2({
  govde,
  raporId,
  onGuncellendi,
}: {
  govde: RaporGovdesiV2;
  raporId?: string;
  onGuncellendi?: () => Promise<void> | void;
}) {
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

      {/* Eksik üretilen bölümler en üstte: rapor gönderilmeden önce
          görülmeli. Bu kutu yalnızca panelde; PDF'e basılmaz. */}
      {govde.uyarilar && govde.uyarilar.length > 0 ? (
        <div className="kil-uyari space-y-2 p-4">
          <h3 className="text-sm font-semibold text-vurgu-900">
            Bu rapor eksik üretildi ({govde.uyarilar.length})
          </h3>
          <ul className="space-y-2">
            {govde.uyarilar.map((uyari) => (
              <li key={uyari.mesaj} className="text-sm text-vurgu-800">
                <p>{uyari.mesaj}</p>
                <p className="mt-0.5 text-xs text-vurgu-700">
                  <span className="font-medium">Ne yapmalı: </span>
                  {uyari.cozum}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {govde.atolyeIcerikleri.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Atölyeler ve içerikleri</h3>
          {govde.atolyeIcerikleri.map((atolye) => (
            <div key={atolye.atolyeAdi} className="kil-oyuk p-4">
              <DuzenlenebilirMetin
                raporId={raporId}
                alan={{ tur: "atolyeIcerik", atolyeAdi: atolye.atolyeAdi }}
                metin={atolye.metin}
                onGuncellendi={onGuncellendi}
                baslik={<h4 className="font-medium">{atolye.atolyeAdi}</h4>}
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Sosyal, duygusal ve bilişsel beceriler
        </h3>
        {govde.gelisimAlanlari.map((alan) => (
          <div key={alan.ad} className="kil-oyuk p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">{alan.ad}</h4>
              {alan.bant ? <KademeGostergesi bant={alan.bant} /> : <KademeYok />}
            </div>
            {alan.cumle ? (
              <DuzenlenebilirMetin
                raporId={raporId}
                alan={{ tur: "gelisimCumle", alanAdi: alan.ad }}
                metin={alan.cumle}
                onGuncellendi={onGuncellendi}
                sinif="mt-2"
              />
            ) : null}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Atölyelerde ilgi ve başarı</h3>
        {govde.atolyeKademeleri.map((atolye) => (
          <div key={atolye.atolyeAdi} className="kil-oyuk p-4">
            <h4 className="font-medium">{atolye.atolyeAdi}</h4>
            {atolye.metin ? (
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">
                {atolye.metin}
              </p>
            ) : null}
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
          </div>
        ))}

        {/* Asimetri notu bir uyarı: rengi korunuyor, malzemesi basılı şerit. */}
        {govde.asimetriler.map((asimetri) => (
          <div key={asimetri.atolyeAdi} className="kil-uyari p-3">
            <DuzenlenebilirMetin
              raporId={raporId}
              alan={{ tur: "asimetriCumle", atolyeAdi: asimetri.atolyeAdi }}
              metin={asimetri.cumle}
              onGuncellendi={onGuncellendi}
              metinSinifi="text-sm text-vurgu-800"
            />
          </div>
        ))}
      </section>

      {govde.gozlem ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Gözlem raporu</h3>
          <div className="kil-oyuk space-y-3 p-4 text-sm leading-relaxed text-zinc-700">
            <DuzenlenebilirMetin
              raporId={raporId}
              alan={{ tur: "gozlem", bolum: "giris" }}
              metin={govde.gozlem.giris}
              onGuncellendi={onGuncellendi}
            />
            <DuzenlenebilirMetin
              raporId={raporId}
              alan={{ tur: "gozlem", bolum: "profil" }}
              metin={govde.gozlem.profil}
              onGuncellendi={onGuncellendi}
            />

            {govde.gozlem.bloklar.map((blok) => (
              <div key={blok.beceriAdi} className="space-y-1">
                <h4 className="font-medium text-zinc-900">{blok.beceriAdi}</h4>
                {blok.tanim ? (
                  <p className="text-xs text-zinc-500">{blok.tanim}</p>
                ) : null}
                {blok.etkinlik ? <p>{blok.etkinlik}</p> : null}
                <DuzenlenebilirMetin
                  raporId={raporId}
                  alan={{ tur: "gozlemBlok", beceriAdi: blok.beceriAdi }}
                  metin={blok.gozlem}
                  onGuncellendi={onGuncellendi}
                />
              </div>
            ))}

            <div className="space-y-1">
              <h4 className="font-medium text-zinc-900">Sonuç</h4>
              <DuzenlenebilirMetin
                raporId={raporId}
                alan={{ tur: "gozlem", bolum: "sonuc" }}
                metin={govde.gozlem.sonuc}
                onGuncellendi={onGuncellendi}
              />
            </div>

            <div className="space-y-1">
              <h4 className="font-medium text-zinc-900">
                Ev ortamında öneriler
              </h4>
              <DuzenlenebilirMetin
                raporId={raporId}
                alan={{ tur: "gozlem", bolum: "oneriler" }}
                metin={govde.gozlem.oneriler}
                onGuncellendi={onGuncellendi}
              />
              {govde.gozlem.urunler.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs text-zinc-600">
                  {govde.gozlem.urunler.map((urun) => (
                    <li key={urun.url}>{urun.ad}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <div className="kil-oyuk p-4">
          <p className="text-sm text-zinc-600">
            Gözlem bölümü üretilmedi. Bu bölüm yalnızca stajyerlerin puanlama
            formuna yazdığı gözlem notlarından üretilir; not yoksa yazılacak
            somut bir davranış da yoktur.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Sağ üstünde kalem duran, tıklanınca yerinde düzenleyiciye dönüşen metin.
 *
 * Kalem, kutunun üzerine gelince belirginleşir ama dokunmatikte de
 * bulunabilsin diye tamamen gizlenmez. Kaydetme yalnızca bu alanı sunucuya
 * gönderir; başarıda üst bileşen pencereyi tazeler ve düzenleme kapanır.
 */
function DuzenlenebilirMetin({
  raporId,
  alan,
  metin,
  onGuncellendi,
  baslik,
  sinif,
  metinSinifi = "text-sm leading-relaxed text-zinc-700",
}: {
  raporId?: string;
  alan: DuzenlenebilirAlan;
  metin: string;
  onGuncellendi?: () => Promise<void> | void;
  /** Metnin üstünde duran, düzenlenmeyen kısım (ör. atölye adı). */
  baslik?: React.ReactNode;
  sinif?: string;
  metinSinifi?: string;
}) {
  const [duzenleniyor, setDuzenleniyor] = useState(false);
  const [taslak, setTaslak] = useState(metin);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, basla] = useTransition();

  if (!raporId) {
    return (
      <div className={sinif}>
        {baslik}
        <p className={cn(baslik && "mt-1", metinSinifi)}>{metin}</p>
      </div>
    );
  }

  function ac() {
    setTaslak(metin);
    setHata(null);
    setDuzenleniyor(true);
  }

  function kaydet() {
    basla(async () => {
      const sonuc = await raporBolumunuDuzenle(raporId!, alan, taslak);
      if (sonuc.hata) {
        setHata(sonuc.hata);
        return;
      }
      await onGuncellendi?.();
      setDuzenleniyor(false);
    });
  }

  if (duzenleniyor) {
    return (
      <div className={cn("space-y-2", sinif)}>
        {baslik}
        <CokSatirli
          value={taslak}
          onChange={(olay) => setTaslak(olay.target.value)}
          rows={Math.min(12, Math.max(3, Math.ceil(taslak.length / 90)))}
          disabled={kaydediliyor}
          autoFocus
        />
        {hata ? <Bildirim tur="hata">{hata}</Bildirim> : null}
        <div className="flex items-center gap-2">
          <Buton
            type="button"
            onClick={kaydet}
            disabled={kaydediliyor || !taslak.trim()}
            className="px-2.5 py-1.5 text-xs"
          >
            {kaydediliyor ? (
              <span className="inline-flex items-center gap-1.5">
                <DonenHalka className="size-3" />
                Kaydediliyor…
              </span>
            ) : (
              "Kaydet"
            )}
          </Buton>
          <Buton
            type="button"
            tur="sade"
            onClick={() => setDuzenleniyor(false)}
            disabled={kaydediliyor}
            className="px-2.5 py-1.5 text-xs"
          >
            Vazgeç
          </Buton>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group/metin relative", sinif)}>
      {baslik}
      <p className={cn("pr-8", baslik && "mt-1", metinSinifi)}>{metin}</p>
      <button
        type="button"
        onClick={ac}
        aria-label="Bu metni düzenle"
        title="Bu metni düzenle"
        className="kil-buton kil-buton-sade absolute top-0 right-0 flex size-7 items-center justify-center text-zinc-300 group-hover/metin:text-zinc-500 hover:!text-marka-700"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </button>
    </div>
  );
}
