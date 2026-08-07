"use client";

import { useActionState } from "react";
import { Alan, Bildirim, Girdi } from "@/components/ui";
import { GonderButonu } from "@/components/ui-istemci";
import { girisYap, type GirisDurumu } from "./actions";

export function GirisFormu({ devam }: { devam?: string }) {
  const [durum, eylem] = useActionState<GirisDurumu, FormData>(girisYap, {});

  return (
    <form action={eylem} className="space-y-4" noValidate>
      {devam ? <input type="hidden" name="devam" value={devam} /> : null}

      <Alan
        etiket="E-posta veya kullanıcı adı"
        hata={durum.alanHatalari?.email}
      >
        <Girdi
          name="email"
          /* `type="email"` değil: kurum kısa kullanıcı adıyla da giriyor
             (örn. `admin`) ve tarayıcı e-posta doğrulaması bunu engelliyordu.
             `autoCapitalize`/`spellCheck` kapalı — telefon klavyesi ilk harfi
             büyütünce kullanıcı adı eşleşmesin diye. */
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          autoFocus
          defaultValue={durum.email}
          aria-invalid={Boolean(durum.alanHatalari?.email)}
        />
      </Alan>

      <Alan etiket="Parola" hata={durum.alanHatalari?.password}>
        <Girdi
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(durum.alanHatalari?.password)}
        />
      </Alan>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <GonderButonu bekleyenEtiket="Giriş yapılıyor…" className="mt-2 w-full">
        Giriş yap
      </GonderButonu>
    </form>
  );
}
