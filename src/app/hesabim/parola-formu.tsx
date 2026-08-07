"use client";

import { useActionState } from "react";
import { Alan, Bildirim, Girdi } from "@/components/ui";
import { GonderButonu } from "@/components/ui-istemci";
import type { EylemDurumu } from "@/lib/formlar";
import { parolamiDegistir } from "./actions";

export function ParolaFormu() {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    parolamiDegistir,
    {},
  );

  return (
    // key={...}: başarılı değişimden sonra form sıfırlanır, parolalar
    // alanlarda kalmaz.
    <form key={durum.basari ?? "form"} action={eylem} className="space-y-4">
      {durum.basari ? (
        <Bildirim tur="basari">{durum.basari}</Bildirim>
      ) : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <Alan etiket="Mevcut parola" hata={durum.alanHatalari?.mevcut}>
        <Girdi
          name="mevcut"
          type="password"
          autoComplete="current-password"
          required
        />
      </Alan>

      <Alan
        etiket="Yeni parola"
        ipucu="En az 8 karakter."
        hata={durum.alanHatalari?.yeni}
      >
        <Girdi
          name="yeni"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Alan>

      <Alan etiket="Yeni parola (tekrar)" hata={durum.alanHatalari?.tekrar}>
        <Girdi
          name="tekrar"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Alan>

      <GonderButonu bekleyenEtiket="Değiştiriliyor…">Parolayı değiştir</GonderButonu>
    </form>
  );
}
