"use client";

import { useActionState, useState } from "react";
import { Bildirim, Buton, Kart, Rozet } from "@/components/ui";
import { DEGERLENDIRILEMEDI } from "@/lib/puanlama";
import { cn } from "@/lib/utils";
import { PuanSecici } from "@/components/puan-secici";
import {
  DONEM_ETIKETLERI,
  GELISIM_SORULARI,
  type GelisimSorusu,
} from "@/lib/gelisim-degerlendirmesi";
import type { GelisimFormuVerisi } from "@/lib/gelisim-verisi";
import {
  gelisimKaydet,
  type GelisimEylemDurumu,
} from "@/app/stajyer/gelisim/actions";

/**
 * Gelişim testi formu — 18 soru, üç gelişim alanı başlığı altında.
 *
 * Puanlama formuyla aynı doğrulama deseni: eksikler GÖNDERMEDEN ÖNCE
 * yakalanır, ilk eksik soruya kaydırılır; sunucu da aynı listeyi ayrıca
 * doğrular. Katılım adımı yok — testin tamamı her zaman zorunlu.
 */
export function GelisimFormu({
  veri,
  duzenlenebilir,
}: {
  veri: GelisimFormuVerisi;
  duzenlenebilir: boolean;
}) {
  const [durum, eylem, bekliyor] = useActionState<GelisimEylemDurumu, FormData>(
    gelisimKaydet,
    {},
  );

  const [istemciEksikleri, setIstemciEksikleri] = useState<string[]>([]);

  const mevcutCevaplar = new Map(
    veri.cevaplar.map((cevap) => [cevap.anahtar, cevap.deger]),
  );
  const dolduruldu = veri.cevaplar.length > 0;

  function gonder(formVerisi: FormData) {
    const eksik = GELISIM_SORULARI.filter(
      (soru) => !formVerisi.get(`cevap:${soru.anahtar}`),
    ).map((soru) => soru.anahtar);

    if (eksik.length > 0) {
      setIstemciEksikleri(eksik);
      // Kaydırma bir sonraki kareye ertelenir (puanlama formundaki not):
      // kutular kırmızıya boyanınca sayfa uzuyor ve kaydırma yarıda kalıyor.
      requestAnimationFrame(() => {
        document
          .getElementById(`gelisim-${eksik[0]}`)
          ?.scrollIntoView({ block: "center" });
      });
      return;
    }

    setIstemciEksikleri([]);
    eylem(formVerisi);
  }

  const eksikler = new Set([
    ...(durum.eksikSatirlar ?? []),
    ...istemciEksikleri,
  ]);
  const kilitli = !duzenlenebilir || !veri.pencere.acik || !veri.kayitAktif;

  return (
    <Kart className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {DONEM_ETIKETLERI[veri.donem]} gelişim testi
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {dolduruldu
              ? `Dolduruldu${veri.dolduran ? ` · Son giren: ${veri.dolduran}` : ""}`
              : "Henüz doldurulmadı"}
          </p>
        </div>
        {dolduruldu ? (
          <Rozet tur="olumlu">Dolduruldu</Rozet>
        ) : (
          <Rozet tur="uyari">Doldurulmadı</Rozet>
        )}
      </div>

      <form action={gonder} noValidate className="mt-4 space-y-3">
        <input type="hidden" name="kayitId" value={veri.kayitId} />
        <input type="hidden" name="donem" value={veri.donem} />

        <fieldset disabled={kilitli || bekliyor} className="space-y-3">
          <legend className="sr-only">Gelişim testi soruları</legend>

          {GELISIM_SORULARI.map((soru, sira) => {
            const oncekiKategori =
              sira > 0 ? GELISIM_SORULARI[sira - 1].kategori : null;

            return (
              <div key={soru.anahtar} className="space-y-3">
                {soru.kategori !== oncekiKategori ? (
                  <h4 className="pt-1 text-xs font-semibold tracking-wide text-marka-700 uppercase">
                    {soru.kategori}
                  </h4>
                ) : null}
                <GelisimSoruSatiri
                  soru={soru}
                  sira={sira + 1}
                  mevcutDeger={mevcutCevaplar.get(soru.anahtar)}
                  cevaplandi={mevcutCevaplar.has(soru.anahtar)}
                  eksik={eksikler.has(soru.anahtar)}
                />
              </div>
            );
          })}
        </fieldset>

        {istemciEksikleri.length > 0 ? (
          <Bildirim tur="hata">
            {istemciEksikleri.length} soru boş kaldı. Kırmızı işaretli soruları
            doldurun; puan veremiyorsanız “Değerlendirilemedi” seçin.
          </Bildirim>
        ) : null}

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
        {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}

        {kilitli ? (
          <p className="text-xs text-zinc-500">
            {!veri.kayitAktif
              ? "Bu kayıt iptal edildiği için form salt okunur."
              : !veri.pencere.acik
                ? "Bu test henüz açılmadı; açılış gününde doldurulabilir."
                : "Bu formu düzenleme yetkiniz yok."}
          </p>
        ) : (
          <Buton type="submit" disabled={bekliyor}>
            {bekliyor ? "Kaydediliyor…" : "Testi kaydet"}
          </Buton>
        )}
      </form>
    </Kart>
  );
}

function GelisimSoruSatiri({
  soru,
  sira,
  mevcutDeger,
  cevaplandi,
  eksik,
}: {
  soru: GelisimSorusu;
  sira: number;
  /** Kaydedilmiş değer; hiç kaydedilmemişse undefined, "Değerlendirilemedi" null. */
  mevcutDeger: number | null | undefined;
  cevaplandi: boolean;
  eksik: boolean;
}) {
  const [secim, setSecim] = useState<string>(() =>
    typeof mevcutDeger === "number"
      ? String(mevcutDeger)
      : cevaplandi
        ? DEGERLENDIRILEMEDI
        : "",
  );

  return (
    <fieldset
      id={`gelisim-${soru.anahtar}`}
      className={cn(
        "scroll-mt-4 rounded-md border px-3 py-3",
        eksik ? "border-red-300 bg-red-50" : "border-yuzey-200",
      )}
    >
      <legend className="px-1 text-sm text-zinc-800">
        <span className="text-zinc-400">{sira}.</span>{" "}
        <span className="font-medium">{soru.baslik}</span>
      </legend>

      <p className="mt-1 text-sm text-zinc-600">{soru.metin}</p>

      <PuanSecici
        alanAdi={`cevap:${soru.anahtar}`}
        secim={secim}
        onSecim={setSecim}
      />
    </fieldset>
  );
}
