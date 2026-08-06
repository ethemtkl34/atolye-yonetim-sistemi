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
 *
 * Dikey menüde maddeler `bolum` alanına göre başlıklar altında gruplanır;
 * yatay şeritte başlıklar yer kaplamasın diye atlanır.
 */

/**
 * Menü ikonları — 24×24 çizgi ikonlar (stroke). Ayrı bir ikon paketi
 * kurmaya değmeyecek kadar az ikon gerekiyor; hepsi burada duruyor.
 */
const SIMGE_YOLLARI: Record<string, React.ReactNode> = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  takvim: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  yildiz: (
    <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9L12 3z" />
  ),
  grup: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c.7-3.1 3.2-5 6.2-5s5.5 1.9 6.2 5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.8M18.5 15.4c1.4.8 2.4 2.1 2.8 4" />
    </>
  ),
  izgara: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  liste: (
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  ),
  kisi: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4.5 20.5c.9-3.6 3.9-5.8 7.5-5.8s6.6 2.2 7.5 5.8" />
    </>
  ),
  pano: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a2 2 0 0 1 6 0M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  rozet: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M7.5 17c.6-2 2.4-3.2 4.5-3.2s3.9 1.2 4.5 3.2" />
    </>
  ),
  atama: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c.7-3.1 3.2-5 6.2-5s5.5 1.9 6.2 5" />
      <path d="M18 7v6M15 10h6" />
    </>
  ),
  // Kullanıcı yönetimi: kişi + anahtar. "Kişiler" bölümündeki diğer
  // maddelerden ayrışsın diye anahtar eklendi — burası hesap ve rol ekranı.
  anahtar: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c.7-3.1 3.2-5 6.2-5c.7 0 1.4.1 2 .3" />
      <circle cx="17.5" cy="13.5" r="2.5" />
      <path d="M19.3 15.3L22 18v2.5h-2.5" />
    </>
  ),
  // Danışmanlık: konuşma balonu + kalp — görüşme ve terapi kayıtları.
  sohbet: (
    <>
      <path d="M21 11.5a8.5 7.5 0 0 1-8.5 7.5c-1 0-2-.15-2.9-.45L4 20l1.5-4.1A7.2 7.2 0 0 1 4 11.5 8.5 7.5 0 0 1 12.5 4 8.5 7.5 0 0 1 21 11.5z" />
      <path d="M12.5 13.6l-2.3-2.3a1.5 1.5 0 0 1 2.1-2.1l.2.2.2-.2a1.5 1.5 0 0 1 2.1 2.1l-2.3 2.3z" />
    </>
  ),
  puan: (
    <path d="M12 4l2.2 4.6 5 .7-3.6 3.6.8 5-4.4-2.3-4.4 2.3.8-5L4.8 9.3l5-.7L12 4zM12 4v11.6" />
  ),
  rapor: (
    <>
      <path d="M6 2.5h9l4 4V21.5H6z" />
      <path d="M14.5 2.5v4.5H19M9 12h6M9 16h6" />
    </>
  ),
  arsiv: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v11h14V9M10 13h4" />
    </>
  ),
  gorev: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
};

function Simge({ ad }: { ad?: string }) {
  const yol = ad ? SIMGE_YOLLARI[ad] : null;
  if (!yol) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-[18px] shrink-0"
    >
      {yol}
    </svg>
  );
}

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
        {menu.map((oge, sira) => {
          // Dashboard yalnızca tam eşleşmede aktif; diğerleri alt sayfalarda da.
          const kokMu = oge.yol.split("/").length === 2;
          const aktif = kokMu
            ? suankiYol === oge.yol
            : suankiYol.startsWith(oge.yol);

          // Bölüm başlığı: bir önceki maddeden farklı bir bölüme geçiliyorsa.
          const oncekiBolum = sira > 0 ? menu[sira - 1].bolum : undefined;
          const bolumBasligi =
            !yatay && oge.bolum && oge.bolum !== oncekiBolum ? oge.bolum : null;

          const icerik = !oge.hazir ? (
            <span
              className={cn(
                "flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-marka-300",
                yatay ? "whitespace-nowrap" : "justify-between",
              )}
              title={`${oge.paket} paketinde eklenecek`}
            >
              <span className="flex items-center gap-2.5">
                {yatay ? null : <Simge ad={oge.simge} />}
                {oge.etiket}
              </span>
              <span className="rounded bg-marka-700 px-1.5 py-0.5 text-[10px] font-medium text-marka-200">
                {oge.paket}
              </span>
            </span>
          ) : (
            <Link
              href={oge.yol}
              aria-current={aktif ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                yatay && "whitespace-nowrap",
                // Aktif sayfa beyaz zeminle işaretleniyor; koyu menüde en
                // güçlü ayrım bu ve rengi ikinci bir tona gerek bırakmıyor.
                aktif
                  ? "bg-white font-semibold text-marka-800"
                  : "text-marka-100 hover:bg-marka-700 hover:text-white",
              )}
            >
              {yatay ? null : (
                <span className={aktif ? "text-marka-600" : "text-marka-300"}>
                  <Simge ad={oge.simge} />
                </span>
              )}
              {oge.etiket}
            </Link>
          );

          return (
            <li key={oge.yol}>
              {bolumBasligi ? (
                <p className="mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wider text-marka-300/80 uppercase first:mt-0">
                  {bolumBasligi}
                </p>
              ) : null}
              {icerik}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
