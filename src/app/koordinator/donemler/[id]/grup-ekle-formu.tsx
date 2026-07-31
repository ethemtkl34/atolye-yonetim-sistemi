"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alan, Bildirim, Buton, Girdi, Kart } from "@/components/ui";
import { grupEkle, type EylemDurumu } from "../actions";

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Ekleniyor…" : "Grubu ekle"}
    </Buton>
  );
}

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
}: {
  donemId: string;
  bilgi: string;
  /** Doluysa buton kilitlenir — eylemin kesin reddedeceği durumlar için. */
  engelSebebi?: string;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    grupEkle.bind(null, donemId),
    {},
  );
  const [acik, setAcik] = useState(false);
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

          <Alan etiket="Gün" hata={durum.alanHatalari?.day}>
            <select
              name="day"
              defaultValue={durum.degerler?.day ?? "CUMARTESI"}
              className="w-full rounded-md border border-yuzey-200 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
            >
              <option value="CUMARTESI">Cumartesi</option>
              <option value="PAZAR">Pazar</option>
            </select>
          </Alan>

          <Alan etiket="Zaman dilimi" hata={durum.alanHatalari?.timeSlot}>
            <select
              name="timeSlot"
              defaultValue={durum.degerler?.timeSlot ?? "OGLEDEN_ONCE"}
              className="w-full rounded-md border border-yuzey-200 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
            >
              <option value="OGLEDEN_ONCE">Öğleden önce</option>
              <option value="OGLEDEN_SONRA">Öğleden sonra</option>
            </select>
          </Alan>
        </div>

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <div className="flex gap-2">
          <KaydetButonu />
          <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Kart>
  );
}
