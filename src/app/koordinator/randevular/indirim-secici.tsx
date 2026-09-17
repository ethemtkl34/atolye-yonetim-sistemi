"use client";

import { useEffect, useRef, useState } from "react";
import { Alan, secimStili } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import {
  INDIRIM_YUZDELERI,
  MEVCUT_INDIRIM,
  yuzdeIndirimi,
} from "@/lib/randevu/indirim";
import { paraMetni } from "../uzmanlar/sema";

/**
 * Randevu formlarının indirim seçicisi (Eylül 2026): tutar yazılmaz, yüzde
 * seçilir (bkz. `lib/randevu/indirim.ts`). Yeni randevu ve düzenleme aynı
 * bileşeni kullanır.
 *
 * `mevcutIndirimKurus` yalnız düzenlemede ve kayıtlı indirim listedeki bir
 * orana denk gelmiyorsa verilir: o zaman ilk seçenek "Mevcut indirim" olur ve
 * sunucu tutarı olduğu gibi korur.
 *
 * `durum` React 19 tuzağı için: form eylemi bitince `<select>`in DOM değeri
 * ilk seçeneğe düşüyor, state değişmediği için yeniden uygulanmıyor — uzman
 * ve hizmet seçicilerindeki imparatif senkronun aynısı.
 */
export function IndirimSecici({
  varsayilan,
  ucretKurus,
  mevcutIndirimKurus,
  hata,
  durum,
}: {
  /** "0", "5", … ya da "mevcut". */
  varsayilan: string;
  /** Seçili hizmetin katalog ücreti; hizmet seçilmediyse undefined. */
  ucretKurus: number | undefined;
  mevcutIndirimKurus?: number | null;
  hata?: string;
  durum: EylemDurumu;
}) {
  const [secim, setSecim] = useState(varsayilan);
  const secici = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (secici.current) secici.current.value = secim;
  }, [durum, secim]);

  const mevcutVar = mevcutIndirimKurus !== undefined && mevcutIndirimKurus !== null;
  const indirim =
    ucretKurus === undefined
      ? null
      : secim === MEVCUT_INDIRIM
        ? (mevcutIndirimKurus ?? 0)
        : yuzdeIndirimi(ucretKurus, Number(secim) || 0);

  const ipucu =
    ucretKurus === undefined || indirim === null
      ? "Önce hizmet seçin."
      : indirim > 0
        ? `${paraMetni(ucretKurus)} − ${paraMetni(indirim)} = ${paraMetni(Math.max(0, ucretKurus - indirim))}`
        : `Ücret ${paraMetni(ucretKurus)}.`;

  return (
    <Alan etiket="İndirim" hata={hata} ipucu={ipucu}>
      <select
        ref={secici}
        name="indirimYuzde"
        className={secimStili}
        defaultValue={secim}
        onChange={(olay) => setSecim(olay.target.value)}
      >
        {mevcutVar ? (
          <option value={MEVCUT_INDIRIM}>
            Mevcut indirim ({paraMetni(mevcutIndirimKurus!)})
          </option>
        ) : null}
        <option value="0">İndirim yok</option>
        {INDIRIM_YUZDELERI.map((yuzde) => (
          <option key={yuzde} value={String(yuzde)}>
            %{yuzde}
          </option>
        ))}
      </select>
    </Alan>
  );
}
