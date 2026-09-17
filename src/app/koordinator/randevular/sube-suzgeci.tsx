"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { secimStili } from "@/components/ui";
import { subeDegistir } from "@/app/sube/actions";
import { cn } from "@/lib/utils";
import { randevuSubesiDegistir } from "./actions";

/**
 * Randevu takviminin süzgeç çubuğundaki şube seçicisi (Eylül 2026).
 *
 * Sağ üstteki şube kutusuyla AYNI seçim: ayrı bir durum tutmuyor, aynı eylemi
 * çağırıyor — biri değişince sayfa tazelenip ikisi de yeni şubeyi gösteriyor.
 * Süzgeçlerin yanında da durmasının sebebi: kullanıcı takvimi daraltırken
 * gözü süzgeç çubuğunda; şubeyi sağ üstte aramak zorunda kalmamalı.
 *
 * Yönetici için genel şube seçimi (`subeDegistir`, bütün panel), şubeli
 * rollerde randevu şubesi (`randevuSubesiDegistir`, yalnız randevu ekranları)
 * — sağ üstteki kutunun davranışıyla birebir.
 *
 * Şube değişince uzman süzgeci temizleniyor (`suzgecsizYol`): öbür şubede
 * çalışmayan bir uzmanla süzülü kalan takvim sessizce boş görünürdü.
 */
export function SubeSuzgeci({
  aktifSubeId,
  subeler,
  yonetici,
  suzgecsizYol,
}: {
  aktifSubeId: string;
  subeler: readonly { id: string; ad: string }[];
  yonetici: boolean;
  /** Şube değişince gidilecek adres (uzman süzgeci çıkarılmış); yoksa kalınır. */
  suzgecsizYol?: string;
}) {
  const router = useRouter();
  const [bekliyor, gecisBaslat] = useTransition();
  const [gosterilen, iyimserSec] = useOptimistic(aktifSubeId);

  return (
    <label className={cn("flex items-center gap-2", bekliyor && "opacity-60")}>
      <span className="text-sm text-zinc-500">{bekliyor ? "Şube değişiyor…" : "Şube:"}</span>
      <select
        value={gosterilen}
        onChange={(olay) => {
          const secilen = olay.target.value;
          gecisBaslat(async () => {
            iyimserSec(secilen);
            await (yonetici ? subeDegistir(secilen) : randevuSubesiDegistir(secilen));
            if (suzgecsizYol) router.replace(suzgecsizYol);
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
  );
}
