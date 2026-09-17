"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Girdi } from "@/components/ui";

/**
 * Takvimde "tarihe git" (Eylül 2026): geçmişe ya da ileriye hafta hafta
 * tıklamadan doğrudan bir güne atlamak. Seçilen gün görünümün çapası olur —
 * Hafta'da o günün haftası, Ay'da o günün ayı açılır.
 *
 * Değer seçildiği anda gidiliyor, ama yıl klavyeyle yazılırken tarayıcı her
 * tuşta "0002-09-17", "0020-09-17" gibi ara değerler üretiyor; her birine
 * gitmek sayfayı dört kez yükletirdi. Makul olmayan yıllar atlanıyor ve
 * gidiş kısa bir gecikmeyle tek sefere indiriliyor.
 *
 * `tarihsizYol` sunucudan geliyor (görünüm ve süzgeçler korunmuş, `tarih`
 * parametresi çıkarılmış adres): `useSearchParams` burada gereksiz bir
 * istemci bağımlılığı olurdu.
 */
export function TarihAtlayici({
  tarih,
  tarihsizYol,
}: {
  /** Görünümün şu anki çapası, "YYYY-AA-GG". */
  tarih: string;
  tarihsizYol: string;
}) {
  const router = useRouter();
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    [],
  );

  return (
    <label className="flex items-center">
      <span className="sr-only">Tarihe git</span>
      <Girdi
        // Çapa değişince (oklar, "Bugün") kutu da yeni tarihi göstersin.
        key={tarih}
        type="date"
        defaultValue={tarih}
        title="Tarihe git"
        className="w-auto"
        onChange={(olay) => {
          const deger = olay.target.value;
          if (zamanlayici.current) clearTimeout(zamanlayici.current);
          const yil = Number(deger.slice(0, 4));
          if (!deger || deger === tarih || yil < 2000 || yil > 2100) return;
          zamanlayici.current = setTimeout(() => {
            const ayrac = tarihsizYol.includes("?") ? "&" : "?";
            router.push(`${tarihsizYol}${ayrac}tarih=${deger}`);
          }, 350);
        }}
      />
    </label>
  );
}
