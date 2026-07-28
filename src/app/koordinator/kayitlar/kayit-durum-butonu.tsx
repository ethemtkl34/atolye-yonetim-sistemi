"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton } from "@/components/ui";
import { kayitDurumDegistir, type EylemDurumu } from "./actions";

export function KayitDurumButonu({
  kayitId,
  aktif,
}: {
  kayitId: string;
  aktif: boolean;
}) {
  const [durum, setDurum] = useState<EylemDurumu>({});
  const [bekliyor, basla] = useTransition();

  function degistir() {
    if (
      aktif &&
      !window.confirm(
        "Bu kayıt iptal edilecek. Girilmiş puanlamalar korunur. Devam edilsin mi?",
      )
    ) {
      return;
    }

    basla(async () => setDurum(await kayitDurumDegistir(kayitId)));
  }

  return (
    <div className="space-y-2">
      <Buton
        type="button"
        tur={aktif ? "tehlike" : "ikincil"}
        disabled={bekliyor}
        onClick={degistir}
      >
        {bekliyor
          ? "İşleniyor…"
          : aktif
            ? "Kaydı iptal et"
            : "Yeniden etkinleştir"}
      </Buton>
      {durum.basari ? (
        <Bildirim tur="basari">{durum.basari}</Bildirim>
      ) : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
    </div>
  );
}
