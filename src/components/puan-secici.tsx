"use client";

import { DEGERLENDIRILEMEDI } from "@/lib/puanlama";
import {
  DEGERLENDIRILEMEDI_ACIKLAMA,
  PUAN_ACIKLAMALARI,
} from "@/lib/puan-hesaplari";
import { cn } from "@/lib/utils";

/**
 * 1–5 + "Değerlendirilemedi" seçim satırı — puanlama formu ile gelişim testi
 * formunun ortak parçası. Ölçeğin görünümü ve dokunma hedefi kuralı tek yerde
 * dursun diye ayrıldı; iki formda ayrı ayrı kopyalanmış olsaydı telefon
 * ölçüleri sessizce ayrışırdı.
 */

/**
 * Telefonda parmakla vurulabilir hedef.
 *
 * Bu formlar stajyerin telefonundan dolduruluyor: bir günde onlarca soru ×
 * 6 seçenek, yüzlerce dokunma. iOS 44pt, Android 48dp öneriyor. Telefonda
 * 44px, masaüstünde eski sıkı ölçüye dönüyor — orada imleçle vuruluyor ve
 * dikey yer daha değerli.
 */
export const DOKUNMA_HEDEFI =
  "flex min-h-[2.75rem] items-center justify-center px-3 " +
  "sm:inline-flex sm:min-h-0 sm:py-1.5";

export const SECENEKLER = [
  { deger: "1", etiket: "1" },
  { deger: "2", etiket: "2" },
  { deger: "3", etiket: "3" },
  { deger: "4", etiket: "4" },
  { deger: "5", etiket: "5" },
  { deger: DEGERLENDIRILEMEDI, etiket: "Değerlendirilemedi" },
];

/** Seçeneğin ölçekteki karşılığı. */
export function secenekAciklamasi(deger: string): string {
  return deger === DEGERLENDIRILEMEDI
    ? DEGERLENDIRILEMEDI_ACIKLAMA
    : PUAN_ACIKLAMALARI[Number(deger)];
}

/**
 * Seçim satırı. Denetimli: seçilen puanın ANLAMI satırın altında yazılır —
 * "3 neydi" sorusu için sayfanın üstündeki ölçek kartına dönülmesin.
 */
export function PuanSecici({
  alanAdi,
  secim,
  onSecim,
}: {
  alanAdi: string;
  secim: string;
  onSecim: (deger: string) => void;
}) {
  return (
    <>
      {/*
        Telefonda 1–5 beş eşit sütuna yayılıyor, "Değerlendirilemedi" altta
        tam satır. Küçük etiketlere yüzlerce kez dokunmak hem yorucu hem
        hataya açık.
      */}
      <div className="mt-2 grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
        {SECENEKLER.map((secenek) => {
          const secili = secim === secenek.deger;
          const aciklama = secenekAciklamasi(secenek.deger);
          const tamSatir = secenek.deger === DEGERLENDIRILEMEDI;

          return (
            <label
              key={secenek.deger}
              title={aciklama}
              className={cn(
                "cursor-pointer",
                tamSatir && "col-span-5 sm:col-span-1",
              )}
            >
              <input
                type="radio"
                name={alanAdi}
                value={secenek.deger}
                checked={secili}
                onChange={(olay) => onSecim(olay.target.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  DOKUNMA_HEDEFI,
                  "rounded-md border border-yuzey-200 bg-white text-sm text-zinc-700",
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

      {secim ? (
        <p className="mt-2 text-xs text-zinc-600">
          {secim === DEGERLENDIRILEMEDI ? "" : `${secim} — `}
          {secenekAciklamasi(secim)}
        </p>
      ) : null}
    </>
  );
}
