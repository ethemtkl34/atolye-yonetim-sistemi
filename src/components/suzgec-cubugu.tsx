"use client";

import { useState } from "react";
import { Kart } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Süzgeç çubuğu — telefonda KATLANIR (Eylül 2026 mobil turu).
 *
 * Liste ekranlarının çoğunda üç dört süzgeç var; 375 piksellik ekranda her
 * biri kendi satırına düşüp ekranın yarısını yiyordu ve asıl liste katlamanın
 * altında kalıyordu. Telefonda artık tek satırlık bir başlık duruyor
 * ("Süzgeçler · 2 etkin"), dokununca açılıyor. Masaüstünde davranış
 * değişmedi: süzgeçler her zaman açık, yan yana.
 *
 * Katlama CSS ile değil durumla yapılıyor ki içerik TEK kez çizilsin; iki
 * kopya (biri mobil biri masaüstü) aynı `<select>`leri ikiye katlar ve
 * adres satırına yazan bağlantıları çoğaltırdı.
 */
export function SuzgecCubugu({
  etkin = 0,
  children,
}: {
  /** Kaç süzgecin varsayılandan farklı olduğu — telefondaki başlıkta yazılı. */
  etkin?: number;
  children: React.ReactNode;
}) {
  const [acik, setAcik] = useState(false);

  return (
    <Kart className="p-3">
      <button
        type="button"
        onClick={() => setAcik((onceki) => !onceki)}
        aria-expanded={acik}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-2 text-sm sm:hidden"
      >
        <span className="font-medium text-zinc-700">
          Süzgeçler
          {etkin > 0 ? (
            <span className="kil-cip ml-2 px-2 py-0.5 text-xs font-semibold text-marka-700">
              {etkin} etkin
            </span>
          ) : null}
        </span>
        <span className="text-xs text-zinc-500">{acik ? "Gizle" : "Göster"}</span>
      </button>

      <div
        className={cn(
          "flex-wrap items-center gap-4",
          acik ? "mt-2 flex" : "hidden",
          "sm:mt-0 sm:flex",
        )}
      >
        {children}
      </div>
    </Kart>
  );
}
