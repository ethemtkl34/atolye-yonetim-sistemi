"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Buton, Kart, Rozet } from "@/components/ui";
import {
  kayitStajyerDegistir,
  type EylemDurumu,
} from "../kayitlar/actions";

export type AtamaSatiri = {
  id: string;
  ogrenciId: string;
  ogrenciAdi: string;
  program: string;
  grup: string;
  stajyerId: string | null;
  stajyerAdi: string | null;
  /** Dönemin stajyer kadrosu; `null` = kısıt yok. */
  izinliStajyerIdleri: string[] | null;
};

export type AtamaStajyeri = {
  id: string;
  ad: string;
  aktifOgrenciSayisi: number;
};

const SECIM_STILI =
  "w-full rounded-md border border-yuzey-200 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100";

export function AtamaYonetimi({
  atamalar,
  stajyerler,
}: {
  atamalar: AtamaSatiri[];
  stajyerler: AtamaStajyeri[];
}) {
  const [durum, setDurum] = useState<Record<string, EylemDurumu>>({});
  const [bekleyenId, setBekleyenId] = useState<string | null>(null);
  const [, basla] = useTransition();

  // Atama yapılabilmesi için en az bir aktif stajyer gerekir; yoksa satırlar
  // salt okunur kalır (sayfa üstünde açıklaması var).
  const atamaMumkun = stajyerler.length > 0;

  function guncelle(kayitId: string, formVerisi: FormData) {
    setBekleyenId(kayitId);
    basla(async () => {
      const sonuc = await kayitStajyerDegistir(kayitId, formVerisi);
      // Yalnızca son işlemin bildirimi tutulur; satır satır biriken eski
      // "güncellendi" mesajları hangi işlemin taze olduğunu belirsizleştiriyordu.
      setDurum({ [kayitId]: sonuc });
      setBekleyenId(null);
    });
  }

  return (
    <div className="space-y-3">
      {atamalar.map((atama) => {
        // Kadro tanımlı satırlarda seçenekler kadroya indirgenir. Mevcut
        // stajyer kadro dışında kalmışsa (kadro sonradan daraltılmış olabilir)
        // görünümü "Şu an:" satırı taşır; seçenek olarak sunulmaz.
        const secenekler = atama.izinliStajyerIdleri
          ? stajyerler.filter((stajyer) =>
              atama.izinliStajyerIdleri!.includes(stajyer.id),
            )
          : stajyerler;
        const satirdaAtamaMumkun = atamaMumkun && secenekler.length > 0;

        return (
        <Kart key={atama.id} className="p-4">
          <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/koordinator/ogrenciler/${atama.ogrenciId}`}
                  className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                >
                  {atama.ogrenciAdi}
                </Link>
                {atama.stajyerAdi ? null : (
                  <Rozet tur="uyari">Stajyer atanmamış</Rozet>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {atama.program} · {atama.grup}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Şu an: {atama.stajyerAdi ?? "—"}
              </p>
            </div>

            <form
              action={guncelle.bind(null, atama.id)}
              className="space-y-2"
            >
              <div className="flex gap-2">
                <select
                  name="internId"
                  defaultValue={atama.stajyerId ?? ""}
                  aria-label={`${atama.ogrenciAdi} için sorumlu stajyer`}
                  className={SECIM_STILI}
                  disabled={!satirdaAtamaMumkun}
                  required
                >
                  <option value="">
                    {satirdaAtamaMumkun || !atamaMumkun
                      ? "Stajyer seçin…"
                      : "Dönem kadrosunda aktif stajyer yok"}
                  </option>
                  {secenekler.map((stajyer) => (
                    <option key={stajyer.id} value={stajyer.id}>
                      {stajyer.ad} — {stajyer.aktifOgrenciSayisi} aktif öğrenci
                    </option>
                  ))}
                </select>
                <Buton
                  type="submit"
                  disabled={!satirdaAtamaMumkun || bekleyenId === atama.id}
                  engelSebebi={
                    satirdaAtamaMumkun
                      ? undefined
                      : "Bu dönemin kadrosunda aktif stajyer yok. Dönem sayfasından kadroya stajyer ekleyin."
                  }
                >
                  {bekleyenId === atama.id ? "Kaydediliyor…" : "Ata"}
                </Buton>
              </div>
              {atama.izinliStajyerIdleri ? (
                <p className="text-xs text-zinc-500">
                  Dönem kadrosu tanımlı; yalnızca kadrodaki stajyerler
                  listeleniyor.
                </p>
              ) : null}
              {durum[atama.id]?.basari ? (
                <Bildirim tur="basari">
                  {durum[atama.id].basari}
                </Bildirim>
              ) : null}
              {durum[atama.id]?.hata ? (
                <Bildirim tur="hata">{durum[atama.id].hata}</Bildirim>
              ) : null}
            </form>
          </div>
        </Kart>
        );
      })}
    </div>
  );
}
