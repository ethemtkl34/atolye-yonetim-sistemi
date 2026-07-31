"use client";

import { useState, useTransition } from "react";
import type { TermStatus } from "@/generated/prisma/enums";
import { DONEM_DURUMLARI, DONEM_DURUM_GECISLERI } from "@/lib/durumlar";
import { donemDurumDegistir } from "../actions";

/**
 * §4.3 — Dönem durumunu değiştirir.
 *
 * Hata gösterimi şart: kutu `value={mevcutDurum}` ile sunucudan besleniyor,
 * yani eylem başarısız olursa seçim eski değerine geri döner ve kullanıcı
 * hiçbir açıklama görmez — "seçtim ama olmadı" denen durum tam olarak bu.
 * Önceki sürüm eylemin dönüşünü atıyordu.
 */
export function DurumSecici({
  donemId,
  mevcutDurum,
}: {
  donemId: string;
  mevcutDurum: TermStatus;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        Durum
        <select
          value={mevcutDurum}
          disabled={bekliyor}
          onChange={(e) => {
            const yeni = e.target.value as TermStatus;
            setHata(null);
            basla(async () => {
              const sonuc = await donemDurumDegistir(donemId, yeni);
              if (sonuc?.hata) setHata(sonuc.hata);
            });
          }}
          className="rounded-md border border-yuzey-200 px-2 py-1.5 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:opacity-60"
        >
          {/* Yalnızca mevcut durum ve ondan geçilebilen durumlar listelenir;
              sunucu da aynı kuralı uygular, burada saklamak kullanıcıyı
              baştan yanlış seçimden korur. */}
          {Object.entries(DONEM_DURUMLARI)
            .filter(
              ([kod]) =>
                kod === mevcutDurum ||
                DONEM_DURUM_GECISLERI[mevcutDurum].includes(kod as TermStatus),
            )
            .map(([kod, { etiket }]) => (
              <option key={kod} value={kod}>
                {etiket}
              </option>
            ))}
        </select>
      </label>
      {hata ? (
        <p role="alert" className="text-xs text-red-700">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
