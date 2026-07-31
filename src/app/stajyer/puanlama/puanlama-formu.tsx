"use client";

import { useActionState, useState } from "react";
import { Bildirim, Buton, Kart, Rozet } from "@/components/ui";
import {
  DEGERLENDIRILEMEDI,
  PUANLAMA_DURUM_ETIKETLERI,
  type FormSatiri,
  type PuanlamaDurumu,
} from "@/lib/puanlama";
import {
  DEGERLENDIRILEMEDI_ACIKLAMA,
  PUAN_ACIKLAMALARI,
  ortalamaBicimle,
} from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { puanlamaKaydet, type PuanlamaEylemDurumu } from "./actions";

/**
 * §10 — Tek bir atölye oturumunun değerlendirme formu.
 *
 * Her atölyenin kendi formu ve kendi kaydet düğmesi var (§10.1): stajyer beş
 * atölyeyi tek tek doldurur, birini kaydetmek diğerlerini beklemez.
 *
 * Katılmadı seçilince sorular gizlenir (§10.2). Katıldı seçiliyken bütün
 * sorular zorunludur (§10.3); zorunluluk hem burada `required` ile hem de
 * sunucuda ayrıca doğrulanır — istemciye güvenilmez.
 */

export type PuanlamaFormuVerisi = {
  oturumId: string;
  atolyeAdi: string;
  durum: PuanlamaDurumu;
  attended: boolean | null;
  ortalama: number | null;
  satirlar: FormSatiri[];
  puanlanabilir: boolean;
  puanlayan: string | null;
};

const SECENEKLER = [
  { deger: "1", etiket: "1" },
  { deger: "2", etiket: "2" },
  { deger: "3", etiket: "3" },
  { deger: "4", etiket: "4" },
  { deger: "5", etiket: "5" },
  { deger: DEGERLENDIRILEMEDI, etiket: "Değerlendirilemedi" },
];

export function PuanlamaFormu({
  kayitId,
  form,
  duzenlenebilir,
}: {
  kayitId: string;
  form: PuanlamaFormuVerisi;
  duzenlenebilir: boolean;
}) {
  const [durum, eylem, bekliyor] = useActionState<
    PuanlamaEylemDurumu,
    FormData
  >(puanlamaKaydet, {});

  const [katilim, setKatilim] = useState<string>(
    form.attended === null ? "" : form.attended ? "katildi" : "katilmadi",
  );

  const rozet = PUANLAMA_DURUM_ETIKETLERI[form.durum];
  const eksikler = new Set(durum.eksikSatirlar ?? []);
  const kilitli = !duzenlenebilir || !form.puanlanabilir;

  return (
    <Kart className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {form.atolyeAdi}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {form.attended === true
              ? `Ortalama ${ortalamaBicimle(form.ortalama)}`
              : form.attended === false
                ? "Ortalamaya dahil edilmez"
                : "Form henüz doldurulmadı"}
            {form.puanlayan ? ` · Son giren: ${form.puanlayan}` : ""}
          </p>
        </div>
        <Rozet tur={rozet.rozet}>{rozet.etiket}</Rozet>
      </div>

      {!form.puanlanabilir ? (
        <p className="mt-3 rounded-md bg-yuzey-50 px-3 py-2 text-sm text-zinc-600">
          Bu atölye henüz yapılmadı. Form, oturum günü geldiğinde açılır.
        </p>
      ) : (
        <form action={eylem} className="mt-4 space-y-4">
          <input type="hidden" name="oturumId" value={form.oturumId} />
          <input type="hidden" name="kayitId" value={kayitId} />

          <fieldset disabled={kilitli || bekliyor}>
            <legend className="text-sm font-medium text-zinc-700">
              Katılım durumu
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { deger: "katildi", etiket: "Katıldı" },
                { deger: "katilmadi", etiket: "Katılmadı" },
              ].map((secenek) => (
                <label
                  key={secenek.deger}
                  className={cn(
                    "cursor-pointer rounded-md border px-3 py-2 text-sm",
                    katilim === secenek.deger
                      ? "border-marka-600 bg-marka-50 font-medium text-marka-700"
                      : "border-yuzey-200 bg-white text-zinc-700 hover:bg-marka-50",
                  )}
                >
                  <input
                    type="radio"
                    name="attended"
                    value={secenek.deger}
                    checked={katilim === secenek.deger}
                    onChange={(olay) => setKatilim(olay.target.value)}
                    className="sr-only"
                    required
                  />
                  {secenek.etiket}
                </label>
              ))}
            </div>
          </fieldset>

          {katilim === "katilmadi" ? (
            <p className="rounded-md bg-yuzey-50 px-3 py-2 text-sm text-zinc-600">
              Katılmadı işaretlenen atölyede puanlama soruları doldurulmaz ve
              bu oturum hiçbir ortalamaya dahil edilmez.
            </p>
          ) : null}

          {katilim === "katildi" ? (
            <fieldset
              disabled={kilitli || bekliyor}
              className="space-y-3 border-t border-yuzey-100 pt-4"
            >
              <legend className="sr-only">Değerlendirme soruları</legend>

              {form.satirlar.map((satir, sira) => (
                <SoruSatiri
                  key={satir.anahtar}
                  satir={satir}
                  sira={sira + 1}
                  eksik={eksikler.has(satir.anahtar)}
                />
              ))}
            </fieldset>
          ) : null}

          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
          {durum.basari ? (
            <Bildirim tur="basari">{durum.basari}</Bildirim>
          ) : null}

          {kilitli ? (
            // Bu dala tek yoldan düşülür: kayıt iptal edilmiştir (puanlanabilir
            // olmayan form yukarıda erken döner, çağıran taraflar
            // `duzenlenebilir`i kayıt durumundan türetir). Metin sebebi
            // söylemeli; "yetkiniz yok" demek yanlış yönlendiriyordu.
            <p className="text-xs text-zinc-500">
              Bu kayıt iptal edildiği için form salt okunur. Girilmiş puanlar
              korunuyor.
            </p>
          ) : (
            <Buton type="submit" disabled={bekliyor}>
              {bekliyor ? "Kaydediliyor…" : "Formu kaydet"}
            </Buton>
          )}
        </form>
      )}
    </Kart>
  );
}

function SoruSatiri({
  satir,
  sira,
  eksik,
}: {
  satir: FormSatiri;
  sira: number;
  eksik: boolean;
}) {
  const alanAdi = `cevap:${satir.anahtar}`;

  return (
    <fieldset
      className={cn(
        "rounded-md border px-3 py-3",
        eksik ? "border-red-300 bg-red-50" : "border-yuzey-200",
      )}
    >
      <legend className="px-1 text-sm text-zinc-800">
        <span className="text-zinc-400">{sira}.</span> {satir.metin}
        {!satir.aktif ? (
          <span className="ml-2 text-xs text-zinc-500">
            (soru pasife alındı, geçmiş cevap korunuyor)
          </span>
        ) : null}
      </legend>

      {satir.guncelMetin ? (
        <p className="mt-1 text-xs text-zinc-500">
          Soru metni sonradan güncellendi: “{satir.guncelMetin}”. Bu
          değerlendirme o günkü metinle kayıtlı kalır.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {SECENEKLER.map((secenek) => {
          const secili =
            satir.mevcutDeger === null
              ? satir.cevaplandi && secenek.deger === DEGERLENDIRILEMEDI
              : String(satir.mevcutDeger) === secenek.deger;

          const aciklama =
            secenek.deger === DEGERLENDIRILEMEDI
              ? DEGERLENDIRILEMEDI_ACIKLAMA
              : PUAN_ACIKLAMALARI[Number(secenek.deger)];

          return (
            <label
              key={secenek.deger}
              title={aciklama}
              className="cursor-pointer"
            >
              <input
                type="radio"
                name={alanAdi}
                value={secenek.deger}
                defaultChecked={secili}
                required
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-flex items-center rounded-md border border-yuzey-200 bg-white px-3 py-1.5 text-sm text-zinc-700",
                  "hover:bg-marka-50 peer-checked:border-marka-600 peer-checked:bg-marka-50 peer-checked:font-medium peer-checked:text-marka-700",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-marka-100",
                )}
              >
                {secenek.etiket}
              </span>
              <span className="sr-only">{aciklama}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** §10.4 — Puan açıklamaları formun yanında görünür. */
export function PuanlamaOlcegi() {
  return (
    <Kart className="p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Puanlama ölçeği</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-36 shrink-0 text-zinc-500">Değerlendirilemedi</dt>
          <dd className="text-zinc-700">{DEGERLENDIRILEMEDI_ACIKLAMA}</dd>
        </div>
        {[1, 2, 3, 4, 5].map((puan) => (
          <div key={puan} className="flex gap-2">
            <dt className="w-36 shrink-0 text-zinc-500">{puan}</dt>
            <dd className="text-zinc-700">{PUAN_ACIKLAMALARI[puan]}</dd>
          </div>
        ))}
      </dl>
    </Kart>
  );
}
