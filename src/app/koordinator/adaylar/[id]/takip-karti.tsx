"use client";

import { useEklemePaneli, useSunucuIslemi } from "@/components/bolum-iskeleti";
import { Alan, Bildirim, Girdi, Kart, secimStili } from "@/components/ui";
import { GonderButonu } from "@/components/ui-istemci";
import { sorumluAta, takipTarihiAta } from "../actions";

/**
 * §16.6 — Takip kartı: sonraki arama tarihi + sorumlu danışman.
 *
 * Eylem şeridinin hemen ALTINDA duruyor. "Ulaşılamadı" düğmesi tarihi
 * kendiliğinden yarına alıyor; o davranışın sihirli görünmemesi için
 * değiştirilebilir alan aynı ekranda ve göz hizasında olmalı.
 */
export function AdayTakipKarti({
  adayId,
  nextActionDate,
  nextActionNote,
  sorumluId,
  kadro,
}: {
  adayId: string;
  nextActionDate: string;
  nextActionNote: string;
  sorumluId: string;
  kadro: { id: string; name: string }[];
}) {
  const { durum, eylem } = useEklemePaneli(takipTarihiAta.bind(null, adayId));
  const sorumlu = useSunucuIslemi();

  return (
    <Kart className="space-y-4 p-4">
      <h2 className="text-base font-bold tracking-tight text-zinc-900">
        Takip
      </h2>

      <form action={eylem} className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <Alan
          etiket="Sonraki arama"
          ipucu="Boş bırakılırsa kuyruğa düşmez."
          hata={durum.alanHatalari?.nextActionDate}
        >
          <Girdi
            name="nextActionDate"
            type="date"
            defaultValue={durum.degerler?.nextActionDate ?? nextActionDate}
          />
        </Alan>

        <Alan etiket="Takip notu" hata={durum.alanHatalari?.nextActionNote}>
          <Girdi
            name="nextActionNote"
            placeholder="Akşam 18.00'den sonra aranacak"
            defaultValue={durum.degerler?.nextActionNote ?? nextActionNote}
          />
        </Alan>

        <GonderButonu>Kaydet</GonderButonu>
      </form>

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      {kadro.length > 1 ? (
        <Alan etiket="Sorumlu">
          <select
            className={secimStili}
            defaultValue={sorumluId}
            disabled={sorumlu.calisiyor}
            onChange={(e) =>
              sorumlu.calistir(() => sorumluAta(adayId, e.target.value))
            }
          >
            <option value="">Atanmamış</option>
            {kadro.map((kisi) => (
              <option key={kisi.id} value={kisi.id}>
                {kisi.name}
              </option>
            ))}
          </select>
        </Alan>
      ) : null}

      {sorumlu.durum.hata ? (
        <Bildirim tur="hata">{sorumlu.durum.hata}</Bildirim>
      ) : null}
    </Kart>
  );
}
