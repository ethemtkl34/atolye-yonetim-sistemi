"use client";

import { useTransition } from "react";
import type { TermStatus } from "@/generated/prisma/enums";
import { DONEM_DURUMLARI } from "@/lib/durumlar";
import { donemDurumDegistir } from "../actions";

/** §4.3 — Dönem durumunu değiştirir. */
export function DurumSecici({
  donemId,
  mevcutDurum,
}: {
  donemId: string;
  mevcutDurum: TermStatus;
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
            await donemDurumDegistir(donemId, e.target.value as TermStatus);
          })
        }
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:opacity-60"
      >
        {Object.entries(DONEM_DURUMLARI).map(([kod, { etiket }]) => (
          <option key={kod} value={kod}>
            {etiket}
          </option>
        ))}
      </select>
    </label>
  );
}
