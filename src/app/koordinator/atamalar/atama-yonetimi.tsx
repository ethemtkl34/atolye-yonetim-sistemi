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
};

export type AtamaStajyeri = {
  id: string;
  ad: string;
  aktifOgrenciSayisi: number;
};

const SECIM_STILI =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100";

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

  function guncelle(kayitId: string, formVerisi: FormData) {
    setBekleyenId(kayitId);
    basla(async () => {
      const sonuc = await kayitStajyerDegistir(kayitId, formVerisi);
      setDurum((mevcut) => ({ ...mevcut, [kayitId]: sonuc }));
      setBekleyenId(null);
    });
  }

  return (
    <div className="space-y-3">
      {atamalar.map((atama) => (
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
                  required
                >
                  <option value="">Stajyer seçin…</option>
                  {stajyerler.map((stajyer) => (
                    <option key={stajyer.id} value={stajyer.id}>
                      {stajyer.ad} — {stajyer.aktifOgrenciSayisi} aktif öğrenci
                    </option>
                  ))}
                </select>
                <Buton type="submit" disabled={bekleyenId === atama.id}>
                  {bekleyenId === atama.id ? "Kaydediliyor…" : "Ata"}
                </Buton>
              </div>
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
      ))}
    </div>
  );
}
