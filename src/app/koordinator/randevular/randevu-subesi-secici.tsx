"use client";

import { useOptimistic, useTransition } from "react";
import { Rozet, secimStili } from "@/components/ui";
import { cn } from "@/lib/utils";
import { randevuSubesiDegistir } from "./actions";

/**
 * Danışma görevlisinin randevular ekranındaki şube seçicisi (Eylül 2026).
 *
 * Randevu takvimi iki şubeyi birlikte gösteriyor ama yalnız "üzerinde
 * çalışılan" şubenin randevusu düzenlenebiliyor. Güneşli'ye bağlı bir
 * danışma görevlisi Ümraniye'nin randevularını ancak buradan Ümraniye'ye
 * geçerek yönetir. Seçim YALNIZ bu ekranı etkiler; üst şeritteki şube ve
 * panelin geri kalanı değişmez — bu yüzden başka şubedeyken yanında bunu
 * söyleyen bir rozet duruyor.
 *
 * Değer seçildiği anda uygulanıyor (üst şeritteki yönetici seçicisiyle aynı
 * desen, bkz. `sube-gostergesi.tsx`): `useOptimistic` seçimi hemen
 * gösteriyor, sunucu turu bitince gerçek değere dönüyor.
 */
export function RandevuSubesiSecici({
  aktifSubeId,
  kendiSubeAdi,
  subeler,
}: {
  aktifSubeId: string;
  kendiSubeAdi: string;
  subeler: readonly { id: string; ad: string }[];
}) {
  const [bekliyor, gecisBaslat] = useTransition();
  const [gosterilenSubeId, iyimserSec] = useOptimistic(aktifSubeId);

  const gosterilen = subeler.find((sube) => sube.id === gosterilenSubeId);
  const baskaSubede = gosterilen !== undefined && gosterilen.ad !== kendiSubeAdi;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", bekliyor && "opacity-60")}>
      <label className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">
          {bekliyor ? "Şube değişiyor…" : "Randevu şubesi:"}
        </span>
        <select
          aria-label="Randevu şubesi"
          value={gosterilenSubeId}
          onChange={(olay) => {
            const secilen = olay.target.value;
            // Geçiş callback'i ASENKRON olmalı; aksi hâlde iyimser değer
            // sunucu cevabından önce geri alınıyor (sube-gostergesi.tsx notu).
            gecisBaslat(async () => {
              iyimserSec(secilen);
              await randevuSubesiDegistir(secilen);
            });
          }}
          className={`${secimStili} w-auto`}
        >
          {subeler.map((sube) => (
            <option key={sube.id} value={sube.id}>
              {sube.ad}
            </option>
          ))}
        </select>
      </label>
      {baskaSubede ? (
        <Rozet tur="uyari">Yalnız randevularda · panelin geri kalanı {kendiSubeAdi}</Rozet>
      ) : null}
    </div>
  );
}
