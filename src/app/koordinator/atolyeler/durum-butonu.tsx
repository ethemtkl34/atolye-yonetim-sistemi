"use client";

import { useState, useTransition } from "react";
import { Buton } from "@/components/ui";
import type { EylemDurumu } from "./actions";

/**
 * Aktif/pasif geçişi.
 *
 * Başarı mesajı gösterilmiyor: değişiklik satırdaki rozette anında görünüyor,
 * ayrıca bildirim çıkarmak gürültü olurdu. Ama HATA gösterilmek zorunda —
 * önceki sürüm sonucu `void` ile atıyordu ve eylem başarısız olduğunda rozet
 * de değişmediği için buton bozuk görünüyordu.
 */
export function DurumButonu({
  eylem,
  aktif,
}: {
  eylem: () => Promise<EylemDurumu>;
  aktif: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Buton
        tur="ikincil"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            const sonuc = await eylem();
            setHata(sonuc?.hata ?? null);
          })
        }
      >
        {aktif ? "Pasife al" : "Aktifleştir"}
      </Buton>
      {hata ? (
        <p role="alert" className="text-xs text-red-700">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
