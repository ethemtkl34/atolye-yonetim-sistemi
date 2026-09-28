"use client";

import { useEffect, useRef } from "react";
import { Alan, secimStili } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import {
  KAYITLI_TARIFE,
  tarifeSecilebilirMi,
  type TarifeliHizmet,
} from "@/lib/randevu/tarife";
import { paraMetni } from "../uzmanlar/sema";

/**
 * §17.9 — Randevunun tarifesi (28 Eylül 2026).
 *
 * Hizmetin iki ücreti olabiliyor: güncel ve eski danışan. Hangisinin
 * geçerli olduğunu randevuyu açan kişi seçiyor; indirim de SEÇİLEN ücretin
 * üzerinden hesaplanıyor (bkz. `lib/randevu/tarife.ts`).
 *
 * Hizmetin ikinci ücreti YOKSA seçici çizilmiyor — tek seçenekli bir açılır
 * liste kullanıcıya hiçbir şey sormaz, yalnız yer kaplar. Gizli alan yine
 * gidiyor ki sunucu her zaman açık bir tarife görsün.
 *
 * `durum` React 19 tuzağı için: form eylemi bitince `<select>`in DOM değeri
 * ilk seçeneğe düşüyor ve state değişmediği için yeniden uygulanmıyor —
 * `IndirimSecici`'deki imparatif senkronun aynısı.
 */
export function TarifeSecici({
  deger,
  onDegis,
  hizmet,
  kayitliUcretKurus,
  hata,
  durum,
}: {
  deger: string;
  onDegis: (deger: string) => void;
  /** Seçili hizmet; seçilmediyse undefined. */
  hizmet: TarifeliHizmet | undefined;
  /**
   * Düzenlemede randevuya YAZILMIŞ ücret. Verilirse ilk seçenek "kayıtlı
   * ücret" olur ve sunucu tutarı olduğu gibi korur: formu açıp yalnız notu
   * değiştiren kullanıcı, katalog o arada zamlandıysa ücreti farkında
   * olmadan güncellememeli.
   */
  kayitliUcretKurus?: number | null;
  hata?: string;
  durum: EylemDurumu;
}) {
  const secici = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (secici.current) secici.current.value = deger;
  }, [durum, deger]);

  const kayitliVar = kayitliUcretKurus !== undefined && kayitliUcretKurus !== null;
  const ikinciVar = hizmet !== undefined && tarifeSecilebilirMi(hizmet);

  // Seçilecek bir şey yoksa alan çizilmiyor; değer gizli alanla gidiyor.
  if (!ikinciVar && !kayitliVar) {
    return <input type="hidden" name="tarife" value={deger} />;
  }

  const etiketle = (kurus: number) => (kurus === 0 ? "ücretsiz" : paraMetni(kurus));

  return (
    <Alan
      etiket="Tarife"
      hata={hata}
      ipucu={
        ikinciVar
          ? "Zam sonrası devam eden danışana eski tarife uygulanır."
          : "Bu hizmetin tek ücreti var."
      }
    >
      <select
        ref={secici}
        name="tarife"
        className={secimStili}
        defaultValue={deger}
        onChange={(olay) => onDegis(olay.target.value)}
        required
      >
        {kayitliVar ? (
          <option value={KAYITLI_TARIFE}>
            Kayıtlı ücret · {etiketle(kayitliUcretKurus)}
          </option>
        ) : null}
        {hizmet ? (
          <option value="guncel">Güncel ücret · {etiketle(hizmet.ucretKurus)}</option>
        ) : null}
        {hizmet && hizmet.eskiDanisanUcretKurus !== null ? (
          <option value="eski">
            Eski danışan ücreti · {etiketle(hizmet.eskiDanisanUcretKurus)}
          </option>
        ) : null}
      </select>
    </Alan>
  );
}
