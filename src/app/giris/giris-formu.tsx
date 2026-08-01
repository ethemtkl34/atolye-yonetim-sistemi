"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { girisYap, type GirisDurumu } from "./actions";

function GonderButonu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 min-h-[2.75rem] w-full rounded-md bg-marka-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-marka-700 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
    >
      {pending ? "Giriş yapılıyor…" : "Giriş yap"}
    </button>
  );
}

export function GirisFormu({ devam }: { devam?: string }) {
  const [durum, eylem] = useActionState<GirisDurumu, FormData>(girisYap, {});

  return (
    <form action={eylem} className="space-y-4" noValidate>
      {devam ? <input type="hidden" name="devam" value={devam} /> : null}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700"
        >
          E-posta veya kullanıcı adı
        </label>
        <input
          id="email"
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
          aria-describedby={
            durum.alanHatalari?.email ? "email-hata" : undefined
          }
          className="mt-1 w-full rounded-md border border-yuzey-200 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
        />
        {durum.alanHatalari?.email ? (
          <p id="email-hata" className="mt-1 text-xs text-red-600">
            {durum.alanHatalari.email}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700"
        >
          Parola
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(durum.alanHatalari?.password)}
          aria-describedby={
            durum.alanHatalari?.password ? "parola-hata" : undefined
          }
          className="mt-1 w-full rounded-md border border-yuzey-200 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
        />
        {durum.alanHatalari?.password ? (
          <p id="parola-hata" className="mt-1 text-xs text-red-600">
            {durum.alanHatalari.password}
          </p>
        ) : null}
      </div>

      {durum.hata ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {durum.hata}
        </p>
      ) : null}

      <GonderButonu />
    </form>
  );
}
