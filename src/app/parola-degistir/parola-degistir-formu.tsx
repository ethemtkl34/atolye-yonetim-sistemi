"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alan, Bildirim, Buton, Girdi } from "@/components/ui";
import { zorunluParolaDegistir, type EylemDurumu } from "./actions";

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Parolayı belirle ve devam et"}
    </Buton>
  );
}

export function ParolaDegistirFormu() {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    zorunluParolaDegistir,
    {},
  );

  return (
    <form action={eylem} className="space-y-4">
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <Alan etiket="Geçici parola" hata={durum.alanHatalari?.mevcut}>
        <Girdi
          name="mevcut"
          type="password"
          autoComplete="current-password"
          autoFocus
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

      <KaydetButonu />
    </form>
  );
}
