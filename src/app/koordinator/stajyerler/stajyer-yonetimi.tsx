"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alan, Bildirim, Buton, Girdi, Kart, Rozet, butonStili, kartBasligiStili } from "@/components/ui";
import {
  stajyerAdiGuncelle,
  stajyerDurumDegistir,
  stajyerEkle,
  stajyerParolaSifirla,
  type EylemDurumu,
} from "./actions";

export type StajyerSatiri = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  aktifOgrenciSayisi: number;
  puanlamaSayisi: number;
};

function GonderButonu({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : etiket}
    </Buton>
  );
}

export function StajyerYonetimi({ stajyerler }: { stajyerler: StajyerSatiri[] }) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  const [acikPanel, setAcikPanel] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {mesaj?.basari ? <Bildirim tur="basari">{mesaj.basari}</Bildirim> : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      <StajyerEkleFormu />

      <div className="space-y-2">
        {stajyerler.map((stajyer) => (
          <Kart key={stajyer.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/stajyerler/${stajyer.id}`}
                    className={kartBasligiStili}
                  >
                    {stajyer.name}
                  </Link>
                  {stajyer.active ? null : <Rozet tur="pasif">Pasif</Rozet>}
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">{stajyer.email}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {/* §8 — Sistem stajyerin öğrenci sayısını gösterir ama
                      sabit bir üst sınır uygulamaz. */}
                  {stajyer.aktifOgrenciSayisi} aktif öğrenci ·{" "}
                  {stajyer.puanlamaSayisi} puanlama
                </p>
              </div>

              {/* Telefonda düğmeler tam satıra iniyor: `shrink-0` yüzünden sıra
                  ekrandan taşıyor ve sayfa yana kayıyordu. */}
              <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:shrink-0">
                <Link
                  href={`/koordinator/stajyerler/${stajyer.id}`}
                  className={butonStili("ikincil")}
                >
                  Öğrenci ata
                </Link>
                <Buton
                  tur="sade"
                  disabled={bekliyor}
                  onClick={() =>
                    setAcikPanel(
                      acikPanel === `ad-${stajyer.id}`
                        ? null
                        : `ad-${stajyer.id}`,
                    )
                  }
                >
                  Adı düzenle
                </Buton>
                <Buton
                  tur="sade"
                  disabled={bekliyor}
                  onClick={() =>
                    setAcikPanel(
                      acikPanel === `parola-${stajyer.id}`
                        ? null
                        : `parola-${stajyer.id}`,
                    )
                  }
                >
                  Parola yenile
                </Buton>
                <Buton
                  tur="ikincil"
                  disabled={bekliyor}
                  onClick={() =>
                    basla(async () =>
                      setMesaj(await stajyerDurumDegistir(stajyer.id)),
                    )
                  }
                >
                  {stajyer.active ? "Pasife al" : "Aktifleştir"}
                </Buton>
              </div>
            </div>

            {acikPanel === `ad-${stajyer.id}` ? (
              <div className="mt-4 border-t border-yuzey-100 pt-4">
                <AdDuzenleFormu
                  stajyer={stajyer}
                  kapat={() => setAcikPanel(null)}
                />
              </div>
            ) : null}

            {acikPanel === `parola-${stajyer.id}` ? (
              <div className="mt-4 border-t border-yuzey-100 pt-4">
                <ParolaFormu
                  stajyerId={stajyer.id}
                  kapat={() => setAcikPanel(null)}
                />
              </div>
            ) : null}
          </Kart>
        ))}
      </div>
    </div>
  );
}

function StajyerEkleFormu() {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    stajyerEkle,
    {},
  );
  const [acik, setAcik] = useState(false);
  const [gorulen, setGorulen] = useState(durum.basari);

  if (durum.basari !== gorulen) {
    setGorulen(durum.basari);
    if (durum.basari) setAcik(false);
  }

  if (!acik) {
    return (
      <div className="space-y-3">
        {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
        <Buton onClick={() => setAcik(true)}>Yeni stajyer ekle</Buton>
      </div>
    );
  }

  return (
    <Kart className="p-4">
      <form action={eylem} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Ad soyad" hata={durum.alanHatalari?.name}>
            <Girdi
              name="name"
              defaultValue={durum.degerler?.name}
              autoFocus
              required
            />
          </Alan>

          <Alan etiket="E-posta" hata={durum.alanHatalari?.email}>
            <Girdi
              name="email"
              type="email"
              defaultValue={durum.degerler?.email}
              required
            />
          </Alan>
        </div>

        <Alan
          etiket="Başlangıç parolası"
          ipucu="En az 8 karakter. Stajyere iletin ve ilk girişten sonra değiştirmesini isteyin."
          hata={durum.alanHatalari?.password}
        >
          <Girdi name="password" type="text" required />
        </Alan>

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <div className="flex gap-2">
          <GonderButonu etiket="Stajyeri ekle" />
          <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Kart>
  );
}

function AdDuzenleFormu({
  stajyer,
  kapat,
}: {
  stajyer: StajyerSatiri;
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    stajyerAdiGuncelle.bind(null, stajyer.id),
    {},
  );

  return (
    <form action={eylem} className="space-y-3">
      <Alan etiket="Ad soyad" hata={durum.alanHatalari?.name}>
        <Girdi name="name" defaultValue={stajyer.name} autoFocus />
      </Alan>
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      <div className="flex gap-2">
        <GonderButonu etiket="Kaydet" />
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Kapat
        </Buton>
      </div>
    </form>
  );
}

function ParolaFormu({
  stajyerId,
  kapat,
}: {
  stajyerId: string;
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    stajyerParolaSifirla.bind(null, stajyerId),
    {},
  );

  return (
    <form action={eylem} className="space-y-3">
      <Alan
        etiket="Yeni parola"
        ipucu="En az 8 karakter."
        hata={durum.alanHatalari?.password}
      >
        <Girdi name="password" type="text" autoFocus required minLength={8} />
      </Alan>
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      <div className="flex gap-2">
        <GonderButonu etiket="Parolayı yenile" />
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Kapat
        </Buton>
      </div>
    </form>
  );
}
