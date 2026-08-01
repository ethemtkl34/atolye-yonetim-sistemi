"use client";

import { useTransition } from "react";
import { subeDegistir } from "@/app/sube/actions";
import { cn } from "@/lib/utils";

/**
 * Üst şeritteki şube göstergesi.
 *
 * Sistem iki şubede kullanılıyor ve ekranların çoğu (öğrenci listesi, gruplar,
 * puanlamalar) iki şubede birbirine çok benziyor. Hangi şubede olduğunu
 * söyleyen kalıcı bir işaret olmadan, yanlış şubede iş yapmak fark edilmesi
 * güç bir hata olurdu. Bu yüzden gösterge her ekranda, üst şeritte duruyor.
 *
 * Koordinatör ve stajyerde okunur bir etiket; yöneticide aynı yerde açılır
 * seçici. İkisi de aynı kutuya oturuyor ki panel roller arasında yer
 * değiştirmesin.
 */
export function SubeGostergesi({
  aktifSubeId,
  subeler,
  degistirebilir,
}: {
  aktifSubeId: string;
  subeler: readonly { id: string; ad: string }[];
  degistirebilir: boolean;
}) {
  const [bekliyor, gecisBaslat] = useTransition();

  const aktifSube = subeler.find((sube) => sube.id === aktifSubeId);
  // Şerit rengi şubenin listedeki sırasından: yönetici şube değiştirdiğinde
  // renk de değişiyor, yani "başka şubedeyim" bilgisi metni okumadan önce
  // geliyor. İki şube için iki ton yetiyor; üçüncü şube eklenirse sıraya
  // devam eder.
  const sira = Math.max(
    0,
    subeler.findIndex((sube) => sube.id === aktifSubeId),
  );
  const seritRengi = ["bg-marka-600", "bg-vurgu-600", "bg-emerald-600"][
    sira % 3
  ];

  const kutu =
    "flex items-center gap-2 rounded-md border border-yuzey-200 bg-white py-1 pl-2 pr-1";

  if (!degistirebilir) {
    return (
      <div className={cn(kutu, "pr-2.5")}>
        <span aria-hidden className={cn("h-5 w-1 rounded-full", seritRengi)} />
        <span className="min-w-0">
          <span className="block text-[0.6875rem] leading-tight text-zinc-500">
            Şube
          </span>
          <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight text-zinc-900 sm:max-w-none">
            {aktifSube?.ad ?? "—"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn(kutu, bekliyor && "opacity-60")}>
      <span aria-hidden className={cn("h-5 w-1 rounded-full", seritRengi)} />
      <label className="min-w-0">
        <span className="block text-[0.6875rem] leading-tight text-zinc-500">
          Çalışılan şube
        </span>
        {/*
          Sıradan bir <select>: değiştirildiği anda eylem çalışıyor, ayrıca
          "Kaydet" düğmesi yok. Şube değiştirmek bir form doldurmak değil,
          bir bakış açısı değiştirmek — araya adım koymak yorucu olurdu.
        */}
        <select
          aria-label="Çalışılan şube"
          value={aktifSubeId}
          disabled={bekliyor}
          onChange={(olay) => {
            const secilen = olay.target.value;
            gecisBaslat(() => {
              void subeDegistir(secilen);
            });
          }}
          className="-ml-1 max-w-[11rem] cursor-pointer truncate rounded bg-transparent py-0 pl-1 pr-6 text-sm font-medium leading-tight text-zinc-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600 sm:max-w-none"
        >
          {subeler.map((sube) => (
            <option key={sube.id} value={sube.id}>
              {sube.ad}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
