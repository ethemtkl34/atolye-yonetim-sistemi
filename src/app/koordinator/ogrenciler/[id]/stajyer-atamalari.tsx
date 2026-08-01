"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bildirim, Kart, Rozet, baglantiStili } from "@/components/ui";
import { kayitStajyerDegistir } from "../../kayitlar/actions";

export type AtamaKaydi = {
  kayitId: string;
  programAdi: string;
  grupAdi: string;
  aktif: boolean;
  stajyerId: string | null;
  stajyerAdi: string | null;
  stajyerPasif: boolean;
  /**
   * Bu kayıtta seçilebilecek stajyerler. Dönem kadrosu tanımlıysa yalnızca
   * kadro; kulüplerde ve kadrosuz dönemlerde bütün aktif stajyerler.
   */
  secenekler: { id: string; ad: string }[];
  /** Kadro yüzünden seçenek kalmadıysa gösterilecek açıklama. */
  kadroUyarisi: string | null;
};

/**
 * §8 — Öğrencinin kayıt bazlı stajyer atamaları.
 *
 * Atama buradan doğrudan yapılıyor; önceden ayrı bir "Stajyer atamaları"
 * ekranına gidiliyordu. Aynı iş stajyerin kendi sayfasından da yapılabiliyor
 * (orada stajyer sabit, öğrenciler seçiliyor) — iki ekran da tek server
 * action'ı çağırdığı için kurallar ayrışmıyor.
 */
export function StajyerAtamalari({ kayitlar }: { kayitlar: AtamaKaydi[] }) {
  const router = useRouter();
  const [durum, setDurum] = useState<{
    kayitId: string;
    basari?: string;
    hata?: string;
  } | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();

  function ata(kayitId: string, stajyerId: string) {
    if (!stajyerId) return;
    setBekleyen(kayitId);
    basla(async () => {
      const sonuc = await kayitStajyerDegistir(kayitId, stajyerId);
      setDurum({ kayitId, ...sonuc });
      setBekleyen(null);
      router.refresh();
    });
  }

  return (
    <Kart className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Stajyer atamaları
        </h2>
        <Link
          href="/koordinator/stajyerler"
          className={baglantiStili}
        >
          Stajyerler
        </Link>
      </div>

      {kayitlar.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Henüz atama yok.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {kayitlar.map((kayit) => (
            <div
              key={kayit.kayitId}
              className="rounded-md bg-yuzey-50 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800">
                    {kayit.programAdi} · {kayit.grupAdi}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                    {kayit.aktif ? "Aktif kayıt" : "İptal kayıt"}
                    <span>·</span>
                    {kayit.stajyerAdi ? (
                      <>
                        Sorumlu: {kayit.stajyerAdi}
                        {kayit.stajyerPasif ? " (pasif hesap)" : ""}
                      </>
                    ) : (
                      <Rozet tur="uyari">Stajyer atanmamış</Rozet>
                    )}
                  </p>
                </div>

                {/* İptal edilmiş kayda atama yapılmaz: puanlama zaten
                    kapalıdır, sorumlusunu değiştirmek anlamsız olurdu. */}
                {kayit.aktif ? (
                  kayit.secenekler.length === 0 ? (
                    <p className="max-w-xs text-xs text-vurgu-700">
                      {kayit.kadroUyarisi ?? "Atanabilecek aktif stajyer yok."}
                    </p>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        aria-label={`${kayit.programAdi} kaydı için sorumlu stajyer`}
                        defaultValue={kayit.stajyerId ?? ""}
                        disabled={bekleyen === kayit.kayitId}
                        onChange={(olay) => ata(kayit.kayitId, olay.target.value)}
                        className="min-h-[2.75rem] rounded-md border border-yuzey-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:opacity-60 sm:min-h-0"
                      >
                        <option value="">Stajyer seçin…</option>
                        {kayit.secenekler.map((stajyer) => (
                          <option key={stajyer.id} value={stajyer.id}>
                            {stajyer.ad}
                          </option>
                        ))}
                      </select>
                      {bekleyen === kayit.kayitId ? (
                        <span className="text-xs text-zinc-500">
                          Kaydediliyor…
                        </span>
                      ) : null}
                    </div>
                  )
                ) : null}
              </div>

              {durum?.kayitId === kayit.kayitId && durum.basari ? (
                <div className="mt-2">
                  <Bildirim tur="basari">{durum.basari}</Bildirim>
                </div>
              ) : null}
              {durum?.kayitId === kayit.kayitId && durum.hata ? (
                <div className="mt-2">
                  <Bildirim tur="hata">{durum.hata}</Bildirim>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Kart>
  );
}

