"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { MenuOgesi } from "@/lib/navigasyon";
import { YanMenu } from "./yan-menu";

/**
 * Dar ekranın menüsü.
 *
 * Önceden menü yatay kayan bir şeritti ve işe yaramıyordu: 12 maddenin
 * toplam genişliği 1248px, ekran 375px — sekiz madde ekran dışındaydı ve
 * kaydırılabildiğine dair hiçbir işaret yoktu. Fare tekerleği yatay
 * kaydırmaz, dokunmatikte de "buradan sürükle" ipucu yok. Yani Öğrenciler'den
 * sonraki her ekran telefonda pratikte erişilemezdi.
 *
 * Yerine çekmece kondu ve içine MASAÜSTÜNÜN AYNI menüsü çiziliyor: bölüm
 * başlıkları, ikonlar, aktif işareti. İki cihazda tek zihin haritası oluyor;
 * yatay şerit bölüm başlıklarını da atıyordu, çünkü sığmıyordu.
 *
 * Native `<dialog>`: odak tuzağı, ESC ile kapanma ve arka plan karartması
 * tarayıcıdan geliyor. Projede rapor penceresi de aynı yolu kullanıyor.
 */
export function MobilMenu({
  menu,
  baslik,
}: {
  menu: readonly MenuOgesi[];
  baslik: string;
}) {
  const pencere = useRef<HTMLDialogElement>(null);
  const yol = usePathname();

  // Gezinince kapan. Aksi hâlde yeni sayfa çekmecenin arkasında açılır ve
  // kullanıcı bir de kapatmak zorunda kalır.
  useEffect(() => {
    pencere.current?.close();
  }, [yol]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Menüyü aç"
        onClick={() => pencere.current?.showModal()}
        className="kil-buton kil-buton-sade -ml-1 grid size-11 place-items-center text-marka-800"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
          className="size-6"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <dialog
        ref={pencere}
        // `m-0 h-dvh` ile pencere ortada değil, solda tam boy duruyor:
        // çekmece görünümü için ek bir kaplama katmanına gerek kalmıyor.
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-gradient-to-b from-marka-700 to-marka-900 p-0 text-white shadow-[8px_0_28px_rgba(45,6,26,0.45)] backdrop:bg-marka-950/45 backdrop:backdrop-blur-sm"
        onClick={(olay) => {
          // Arka plana tıklayınca kapansın. `<dialog>` tıklamayı kendisi
          // alıyor; hedef pencerenin kendisiyse tıklama panelin dışına
          // gelmiş demektir.
          if (olay.target === pencere.current) pencere.current?.close();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between px-5 py-4 shadow-[inset_0_-1px_0_var(--kil-koyu-golge)]">
            <span>
              <span className="block text-sm font-semibold text-white">
                Atölye Yönetim
              </span>
              <span className="mt-0.5 block text-xs text-marka-200">
                {baslik}
              </span>
            </span>
            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => pencere.current?.close()}
              className="kil-menu-oge -mr-2 -mt-1 grid size-11 place-items-center text-marka-200 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden
                className="size-5"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <YanMenu menu={menu} />
        </div>
      </dialog>
    </div>
  );
}
