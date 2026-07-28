"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { MenuOgesi } from "@/lib/navigasyon";

export function YanMenu({ menu }: { menu: readonly MenuOgesi[] }) {
  const suankiYol = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto p-3">
      <ul className="space-y-0.5">
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
                  className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400"
                  title={`${oge.paket} paketinde eklenecek`}
                >
                  {oge.etiket}
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
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
                  aktif
                    ? "bg-marka-50 font-medium text-marka-700"
                    : "text-zinc-700 hover:bg-zinc-50",
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
