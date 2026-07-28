"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alan, Bildirim, Buton, Girdi, Kart } from "@/components/ui";
import { kulupGrupEkle, type EylemDurumu } from "../actions";

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Ekleniyor…" : "Grubu ekle"}
    </Buton>
  );
}

/**
 * §5.2 — Kulübe yeni grup ekler.
 *
 * Gün sorulmuyor: kulübün tek tarihi var, bütün grupları o gün toplanıyor.
 * Gruplar zaman dilimiyle ayrışır.
 */
export function GrupEkleFormu({
  kulupId,
  bilgi,
}: {
  kulupId: string;
  bilgi: string;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kulupGrupEkle.bind(null, kulupId),
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
        <Buton onClick={() => setAcik(true)}>Yeni grup ekle</Buton>
      </div>
    );
  }

  return (
    <Kart className="space-y-4 p-4">
      <form action={eylem} className="space-y-4">
        <p className="text-sm text-zinc-600">{bilgi}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup adı" hata={durum.alanHatalari?.name}>
            <Girdi name="name" placeholder="2. Grup" autoFocus required />
          </Alan>

          <Alan etiket="Kontenjan" hata={durum.alanHatalari?.capacity}>
            <Girdi
              name="capacity"
              type="number"
              min={1}
              max={200}
              defaultValue={12}
              required
            />
          </Alan>

          <Alan etiket="Zaman dilimi" hata={durum.alanHatalari?.timeSlot}>
            <select
              name="timeSlot"
              defaultValue="OGLEDEN_SONRA"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
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
