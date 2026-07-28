"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { MenuOgesi } from "@/lib/navigasyon";

/**
 * Panel menüsü.
 *
 * `yon="yatay"` mobil şerit içindir: dar ekranda sol menü gizlendiği için
 * menü üst şeride yatay kayan bir liste olarak iniyor. Aynı bileşen iki
 * yerde kullanılıyor ki aktif sayfa kuralı tek yerde kalsın.
 */
export function YanMenu({
  menu,
  yon = "dikey",
}: {
  menu: readonly MenuOgesi[];
  yon?: "dikey" | "yatay";
}) {
  const suankiYol = usePathname();
  const yatay = yon === "yatay";

  return (
    <nav
      className={cn(
        yatay ? "overflow-x-auto px-3 py-2" : "flex-1 overflow-y-auto p-3",
      )}
    >
      <ul className={cn(yatay ? "flex w-max gap-1" : "space-y-0.5")}>
        {menu.map((oge) => {
          // Dashboard yalnızca tam eşleşmede aktif; diğerleri alt sayfalarda da.
          const kokMu = oge.yol.split("/").length === 2;
          const aktif = kokMu
            ? suankiYol === oge.yol
            : suankiYol.startsWith(oge.yol);

          if (!oge.hazir) {
            return (
              <li key={oge.yol}>
                <span
                  className={cn(
                    "flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm text-marka-300",
                    yatay ? "whitespace-nowrap" : "justify-between",
                  )}
                  title={`${oge.paket} paketinde eklenecek`}
                >
                  {oge.etiket}
                  <span className="rounded bg-marka-700 px-1.5 py-0.5 text-[10px] font-medium text-marka-200">
                    {oge.paket}
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={oge.yol}>
              <Link
                href={oge.yol}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  yatay && "whitespace-nowrap",
                  // Aktif sayfa beyaz zeminle işaretleniyor; koyu menüde en
                  // güçlü ayrım bu ve rengi ikinci bir tona gerek bırakmıyor.
                  aktif
                    ? "bg-white font-semibold text-marka-800"
                    : "text-marka-100 hover:bg-marka-700 hover:text-white",
                )}
              >
                {oge.etiket}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
