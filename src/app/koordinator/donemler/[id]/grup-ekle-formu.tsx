"use client";

import { useActionState, useState } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Alan, Bildirim, Buton, Girdi, Kart, secimStili } from "@/components/ui";
import { GUN_ADLARI } from "@/lib/tarih";
import { cn } from "@/lib/utils";
import type { Day } from "@/generated/prisma/enums";
import type { EylemDurumu } from "@/lib/formlar";
import { grupEkle } from "../actions";

/**
 * §4.2 — Döneme yeni grup ekler.
 *
 * Başlangıç haftası formda sorulmuyor: §13.5 gereği sonradan açılan grup
 * mevcut haftadan devam eder ve bu tarihten kesin olarak türetilir.
 * Koordinatöre kaç hafta atlandığı ve kaç oturum üretildiği işlem sonrasında
 * açıkça yazılır.
 */
export function GrupEkleFormu({
  donemId,
  bilgi,
  engelSebebi,
  secilebilirGunler,
}: {
  donemId: string;
  bilgi: string;
  /** Doluysa buton kilitlenir — eylemin kesin reddedeceği durumlar için. */
  engelSebebi?: string;
  /** Dönemin gün düzeninin kapsadığı günler — liste bununla daralır. */
  secilebilirGunler: Day[];
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    grupEkle.bind(null, donemId),
    {},
  );
  const [acik, setAcik] = useState(false);
  const [gunler, setGunler] = useState<Day[]>(() =>
    secilebilirGunler.slice(0, 1),
  );

  function gunDegistir(gun: Day) {
    setGunler((oncekiler) =>
      oncekiler.includes(gun)
        ? oncekiler.filter((g) => g !== gun)
        : [...oncekiler, gun],
    );
  }
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);

  // Başarıdan sonra paneli kapat (render sırasında durum ayarlama).
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  if (!acik) {
    return (
      <div className="space-y-3">
        {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
        <Buton
          onClick={() => setAcik(true)}
          disabled={Boolean(engelSebebi)}
          engelSebebi={engelSebebi}
        >
          Yeni grup ekle
        </Buton>
        {engelSebebi ? (
          <p className="text-sm text-zinc-500">{engelSebebi}</p>
        ) : null}
      </div>
    );
  }

  return (
    <Kart className="space-y-4 p-4">
      <form action={eylem} className="space-y-4">
        <p className="text-sm text-zinc-600">{bilgi}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup adı" hata={durum.alanHatalari?.name}>
            <Girdi
              name="name"
              placeholder="Örn. 2. Grup"
              defaultValue={durum.degerler?.name}
              autoFocus
              required
            />
          </Alan>

          <Alan etiket="Kontenjan" hata={durum.alanHatalari?.capacity}>
            <Girdi
              name="capacity"
              type="number"
              min={1}
              max={200}
              defaultValue={durum.degerler?.capacity ?? 12}
              required
            />
          </Alan>

          <Alan
            etiket="Toplanma günleri"
            ipucu="Grup her toplanma gününde dönemin bütün atölyelerini yapar."
            hata={durum.alanHatalari?.days}
          >
            <div className="flex flex-wrap gap-1">
              {secilebilirGunler.map((gun) => {
                const secili = gunler.includes(gun);
                return (
                  <label
                    key={gun}
                    className={cn(
                      "flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm sm:min-h-0 sm:py-1.5",
                      secili
                        ? "bg-marka-50 text-marka-700"
                        : "text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="days"
                      value={gun}
                      checked={secili}
                      onChange={() => gunDegistir(gun)}
                      className="size-4"
                    />
                    {GUN_ADLARI[gun]}
                  </label>
                );
              })}
            </div>
          </Alan>

          <Alan etiket="Zaman dilimi" hata={durum.alanHatalari?.timeSlot}>
            <select
              name="timeSlot"
              defaultValue={durum.degerler?.timeSlot ?? "OGLEDEN_ONCE"}
              className={secimStili}
            >
              <option value="OGLEDEN_ONCE">Öğleden önce</option>
              <option value="OGLEDEN_SONRA">Öğleden sonra</option>
            </select>
          </Alan>
        </div>

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <div className="flex gap-2">
          <GonderButonu bekleyenEtiket="Ekleniyor…">Grubu ekle</GonderButonu>
          <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Kart>
  );
}
