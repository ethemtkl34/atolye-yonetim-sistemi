"use client";

import { useTransition } from "react";
import type { ClubStatus } from "@/generated/prisma/enums";
import { KULUP_DURUMLARI } from "@/lib/durumlar";
import { kulupDurumDegistir } from "../actions";

/** §5.3 — Kulüp durumunu değiştirir. */
export function DurumSecici({
  kulupId,
  mevcutDurum,
}: {
  kulupId: string;
  mevcutDurum: ClubStatus;
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      Durum
      <select
        value={mevcutDurum}
        disabled={bekliyor}
        onChange={(e) =>
          basla(async () => {
            await kulupDurumDegistir(kulupId, e.target.value as ClubStatus);
          })
        }
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:opacity-60"
      >
        {Object.entries(KULUP_DURUMLARI).map(([kod, { etiket }]) => (
          <option key={kod} value={kod}>
            {etiket}
          </option>
        ))}
      </select>
    </label>
  );
}
