"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * "Kil" temalı profil kutuları — öğrenci profilindeki her bölüm küçük renkli
 * bir kutu, ayrıntılar kutuya tıklayınca açılan pencerede.
 *
 * Pencere içeriği (children) sunucudan render edilmiş hazır bölüm
 * bileşenleridir (TerapiGorusmeleriBolumu, RaporBolumu...); bu dosya yalnızca
 * kabuğu çizer. Bölümlerin kendi iç pencereleri (rapor düzenleme, görüşme
 * detayı) native <dialog> üst katmanında açıldığı için iç içe sorunsuz
 * çalışır.
 */

/** Kutu renkleri — mockup'ta onaylanan palet. */
const RENKLER = {
  kayit: ["#c2456f", "#9c2f56"],
  veli: ["#7b58c9", "#5f3fae"],
  terapi: ["#2e9d9d", "#22807f"],
  zeka: ["#d9912c", "#b57318"],
  rapor: ["#3f78cf", "#2c5cab"],
  gelisim: ["#3f9d5c", "#2e7f46"],
  genel: ["#8a7f8f", "#6d6373"],
  saglik: ["#cf4f43", "#a93a30"],
  gecmis: ["#9a8570", "#7d6a57"],
  stajyer: ["#5563c9", "#3f4dab"],
} as const;

export type KutuRengi = keyof typeof RENKLER;

/** 24x24 stroke ikonları — bölüm başına bir tane. */
const IKONLAR: Record<KutuRengi, React.ReactNode> = {
  kayit: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  veli: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  terapi: (
    <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.7 5.4 5.4 0 0 1 21.3 12C19 16.4 12 21 12 21z" />
  ),
  zeka: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.8.7-1 1.5-1 2.5h-6c0-1-.2-1.8-1-2.5A6 6 0 0 1 12 3z" />
  ),
  rapor: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M9 13h7M9 17h7" />
    </>
  ),
  gelisim: <path d="M4 20h16M6 16l4-6 3 3 5-8" />,
  genel: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M14 9h4M14 13h4M5.5 17c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4" />
    </>
  ),
  saglik: (
    <>
      <path d="M12 4v16M4 12h16" />
      <circle cx="12" cy="12" r="9.2" />
    </>
  ),
  gecmis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  stajyer: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <circle cx="17" cy="10" r="2.6" />
      <path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5M15.6 15.2c2.3.2 4 1.5 4.9 3.8" />
    </>
  ),
};

export function ProfilKutusu({
  renk,
  baslik,
  altyazi,
  adet,
  baslangictaAcik = false,
  genislik = "44rem",
  kapaninca,
  children,
}: {
  renk: KutuRengi;
  baslik: string;
  altyazi: string;
  /** Sayı rozeti; verilmezse çizilmez (Genel bilgiler, Sağlık). */
  adet?: number;
  /** `?rapor=` gibi derin bağlantılar pencereyi sayfa açılışında açar. */
  baslangictaAcik?: boolean;
  /** Pencere genişliği — geniş içerik (rapor gövdesi) için büyütülür. */
  genislik?: string;
  /** Pencere kapanınca temizlik: "parametre-temizle" adresteki sorguyu siler
      (derin bağlantıyla açılan pencere, tazelemede yeniden açılmasın). */
  kapaninca?: "parametre-temizle";
  children: React.ReactNode;
}) {
  const pencereRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [acik, koyu] = RENKLER[renk];

  useEffect(() => {
    if (baslangictaAcik) pencereRef.current?.showModal();
    // Yalnızca ilk render'da: kullanıcı pencereyi kapattıktan sonra route
    // yenilemeleri (server action revalidate) pencereyi yeniden açmamalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => pencereRef.current?.showModal()}
        className="kil-kutu relative flex min-h-[8.25rem] flex-col justify-between p-4 text-left"
        style={
          {
            "--kil-renk": acik,
            "--kil-renk-koyu": koyu,
          } as React.CSSProperties
        }
      >
        {typeof adet === "number" ? (
          <span className="kil-rozet absolute top-3 right-3 grid h-6 min-w-6 place-items-center rounded-full px-2 text-xs font-bold text-zinc-800">
            {adet}
          </span>
        ) : null}
        <span className="kil-ikon grid size-9 place-items-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden
          >
            {IKONLAR[renk]}
          </svg>
        </span>
        <span className="block">
          <span className="block text-sm font-bold leading-snug text-zinc-800">
            {baslik}
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">{altyazi}</span>
        </span>
      </button>

      <dialog
        ref={pencereRef}
        className="kil-pencere m-auto p-0 text-zinc-900"
        style={{ width: `min(${genislik}, calc(100vw - 2rem))` }}
        // Zemine (backdrop'a) tıklayınca kapat: dialog'un kendisi hedefse
        // tıklama kenar boşluğuna gelmiştir.
        onClick={(e) => {
          if (e.target === pencereRef.current) pencereRef.current?.close();
        }}
        onClose={() => {
          // Derin bağlantı parametresi pencereyle birlikte temizlenir; yoksa
          // her sayfa tazelemesi pencereyi yeniden açar.
          if (kapaninca === "parametre-temizle")
            router.replace(pathname, { scroll: false });
        }}
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-1">
            <div className="flex items-center gap-3">
              <span
                className="kil-ikon grid size-8 place-items-center"
                style={
                  {
                    "--kil-renk": acik,
                    "--kil-renk-koyu": koyu,
                  } as React.CSSProperties
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                  aria-hidden
                >
                  {IKONLAR[renk]}
                </svg>
              </span>
              <h2 className="text-lg font-bold tracking-tight">{baslik}</h2>
            </div>
            <button
              type="button"
              onClick={() => pencereRef.current?.close()}
              aria-label="Pencereyi kapat"
              className="kil-rozet grid size-9 place-items-center rounded-full text-sm font-bold text-zinc-700"
            >
              ✕
            </button>
          </header>
          <div className="overflow-y-auto px-6 pt-3 pb-6">{children}</div>
        </div>
      </dialog>
    </>
  );
}
