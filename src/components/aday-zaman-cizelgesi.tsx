"use client";

import type { LeadActivityType, LeadStage } from "@/generated/prisma/enums";
import { etkinlikEkle } from "@/app/koordinator/adaylar/actions";
import { BolumUstu, useEklemePaneli } from "@/components/bolum-iskeleti";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  CokSatirli,
  Kart,
} from "@/components/ui";
import { GonderButonu } from "@/components/ui-istemci";
import { ADAY_ASAMALARI } from "@/lib/aday-durumlari";

/**
 * §16.3 — Aday etkinlik akışı.
 *
 * Satırlar okunur: silinmez, düzenlenmez (görüşme kayıtları ilkesi). Yanlış
 * yazılan not yeni notla düzeltilir — geçmişi değiştirmek, kimin ne zaman ne
 * yaptığını okunmaz hâle getirir.
 */

export type AdayEtkinligi = {
  id: string;
  type: LeadActivityType;
  note: string | null;
  fromStage: LeadStage | null;
  toStage: LeadStage | null;
  kisi: string | null;
  zaman: string;
};

/**
 * Etkinlik türünün ikon rengi. Genişletilmiş palet yalnızca ikon
 * plakalarında serbest (tasarım dili): satır metni hep aynı tonda kalıyor,
 * göz türü renkten ayırt ediyor.
 */
const TUR_RENKLERI: Record<LeadActivityType, [string, string]> = {
  ARAMA: ["#2dd4bf", "#0f766e"],
  ULASILAMADI: ["#fb923c", "#c2410c"],
  WHATSAPP: ["#34d399", "#047857"],
  NOT: ["#e879b9", "#a3185b"],
  ASAMA_DEGISIMI: ["#fbbf24", "#b45309"],
  SISTEM: ["#a1a1aa", "#52525b"],
};

function satirMetni(etkinlik: AdayEtkinligi): string {
  if (etkinlik.type === "ASAMA_DEGISIMI" && etkinlik.fromStage && etkinlik.toStage) {
    const gecis = `${ADAY_ASAMALARI[etkinlik.fromStage].etiket} → ${ADAY_ASAMALARI[etkinlik.toStage].etiket}`;
    return etkinlik.note ? `${gecis} · ${etkinlik.note}` : gecis;
  }

  switch (etkinlik.type) {
    case "ARAMA":
      return etkinlik.note ? `Arandı — ${etkinlik.note}` : "Arandı";
    case "ULASILAMADI":
      return etkinlik.note
        ? `Arandı, ulaşılamadı — ${etkinlik.note}`
        : "Arandı, ulaşılamadı";
    case "WHATSAPP":
      return etkinlik.note ? `WhatsApp — ${etkinlik.note}` : "WhatsApp yazıldı";
    default:
      return etkinlik.note ?? "—";
  }
}

export function AdayZamanCizelgesi({
  adayId,
  etkinlikler,
  yazabilir,
}: {
  adayId: string;
  etkinlikler: AdayEtkinligi[];
  yazabilir: boolean;
}) {
  const { acik, setAcik, durum, eylem } = useEklemePaneli(
    etkinlikEkle.bind(null, adayId),
  );

  return (
    <div className="space-y-3">
      <BolumUstu
        baslik="Geçmiş"
        adet={etkinlikler.length}
        adetEtiketi="kayıt"
        aksiyon={
          yazabilir ? (
            <Buton type="button" tur="sade" onClick={() => setAcik(!acik)}>
              {acik ? "Vazgeç" : "+ Not ekle"}
            </Buton>
          ) : null
        }
      />

      {acik ? (
        <Kart className="p-4">
          <form action={eylem} className="space-y-3">
            <input type="hidden" name="type" value="NOT" />
            <Alan etiket="Not" hata={durum.alanHatalari?.note}>
              <CokSatirli
                name="note"
                rows={3}
                autoFocus
                placeholder="Görüşmede konuşulanlar, ailenin sorduğu sorular…"
                defaultValue={durum.degerler?.note}
              />
            </Alan>
            {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
            <GonderButonu bekleyenEtiket="Ekleniyor…">Notu ekle</GonderButonu>
          </form>
        </Kart>
      ) : null}

      {etkinlikler.length === 0 ? (
        <BosDurum
          baslik="Henüz kayıt yok."
          aciklama="Arama, not ve aşama değişiklikleri burada listelenir."
        />
      ) : (
        <Kart className="kil-bolmeli">
          {etkinlikler.map((etkinlik) => {
            const [acikRenk, koyuRenk] = TUR_RENKLERI[etkinlik.type];

            return (
              <div key={etkinlik.id} className="flex gap-3 p-3.5">
                <span
                  className="kil-ikon grid size-9 shrink-0 place-items-center"
                  style={
                    {
                      "--kil-renk": acikRenk,
                      "--kil-renk-koyu": koyuRenk,
                    } as React.CSSProperties
                  }
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-[16px]"
                  >
                    {etkinlik.type === "ASAMA_DEGISIMI" ? (
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    ) : etkinlik.type === "NOT" ? (
                      <path d="M6 3.5h9l4 4V20.5H6zM14.5 3.5V8H19M9 12h6M9 16h4" />
                    ) : (
                      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
                    )}
                  </svg>
                </span>

                <div className="min-w-0">
                  <p className="text-sm text-zinc-800">{satirMetni(etkinlik)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {etkinlik.kisi ?? "Sistem"} · {etkinlik.zaman}
                  </p>
                </div>
              </div>
            );
          })}
        </Kart>
      )}
    </div>
  );
}
