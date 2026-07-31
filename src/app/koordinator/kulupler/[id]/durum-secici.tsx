"use client";

import { useState, useTransition } from "react";
import type { ClubStatus } from "@/generated/prisma/enums";
import { KULUP_DURUMLARI, KULUP_DURUM_GECISLERI } from "@/lib/durumlar";
import { kulupDurumDegistir } from "../actions";

/**
 * §5.3 — Kulüp durumunu değiştirir.
 *
 * Hata gösterimi dönem seçicisiyle aynı gerekçeyle şart: eylem reddedilirse
 * kutu eski değerine döner ve kullanıcı sebebini görmez.
 */
export function DurumSecici({
  kulupId,
  mevcutDurum,
}: {
  kulupId: string;
  mevcutDurum: ClubStatus;
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
            const yeni = e.target.value as ClubStatus;
            setHata(null);
            basla(async () => {
              const sonuc = await kulupDurumDegistir(kulupId, yeni);
              if (sonuc?.hata) setHata(sonuc.hata);
            });
          }}
          className="rounded-md border border-yuzey-200 px-2 py-1.5 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:opacity-60"
        >
          {/* Yalnızca mevcut durum ve ondan geçilebilen durumlar listelenir;
              sunucu da aynı kuralı uygular. */}
          {Object.entries(KULUP_DURUMLARI)
            .filter(
              ([kod]) =>
                kod === mevcutDurum ||
                KULUP_DURUM_GECISLERI[mevcutDurum].includes(kod as ClubStatus),
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
