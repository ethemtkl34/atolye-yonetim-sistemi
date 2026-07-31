"use client";

import { useState, useTransition } from "react";
import { Buton } from "@/components/ui";
import { grupDurumDegistir } from "@/app/koordinator/donemler/actions";
import { kulupGrupDurumDegistir } from "@/app/koordinator/kulupler/actions";

/**
 * §2.3 — Grubu kayda kapatır / yeniden açar.
 *
 * Kapalı grup listelerde "Kapalı" rozetiyle görünür ve yeni kayıt alamaz;
 * mevcut kayıtlar, oturumlar ve puanlamalar etkilenmez. Sunucu eylemleri
 * (`grupDurumDegistir` / `kulupGrupDurumDegistir`) P4'ten beri vardı ama
 * arayüzden hiç çağrılmıyordu — rozet ve kayıt engeli çalışıyor, duruma
 * geçişin kendisi imkânsızdı.
 */
export function GrupDurumButonu({
  grupId,
  aktif,
  tur,
}: {
  grupId: string;
  aktif: boolean;
  tur: "donem" | "kulup";
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Buton
        type="button"
        tur="sade"
        disabled={bekliyor}
        onClick={() => {
          setHata(null);
          basla(async () => {
            const eylem =
              tur === "donem" ? grupDurumDegistir : kulupGrupDurumDegistir;
            const sonuc = await eylem(grupId);
            if (sonuc?.hata) setHata(sonuc.hata);
          });
        }}
      >
        {bekliyor ? "Kaydediliyor…" : aktif ? "Kayda kapat" : "Kayda aç"}
      </Buton>
      {hata ? (
        <span role="alert" className="text-xs text-red-700">
          {hata}
        </span>
      ) : null}
    </div>
  );
}
