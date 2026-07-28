"use client";

import { useTransition } from "react";
import { Buton } from "@/components/ui";
import type { EylemDurumu } from "./actions";

/**
 * Aktif/pasif geçişi. Sonuç mesajı gösterilmez çünkü değişiklik zaten
 * satırdaki rozette anında görünür — ayrıca bildirim göstermek gürültü olur.
 */
export function DurumButonu({
  eylem,
  aktif,
}: {
  eylem: () => Promise<EylemDurumu>;
  aktif: boolean;
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <Buton
      tur="ikincil"
      disabled={bekliyor}
      onClick={() => basla(async () => void (await eylem()))}
    >
      {aktif ? "Pasife al" : "Aktifleştir"}
    </Buton>
  );
}
