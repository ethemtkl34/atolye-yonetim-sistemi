"use client";

import { useEffect, useState, useTransition } from "react";
import { randevuVer } from "@/app/koordinator/adaylar/actions";
import { haftaRandevuVerisiEylemi } from "@/app/koordinator/randevular/actions";
import { HaftaIzgarasiGovdesi } from "@/app/koordinator/randevular/hafta-izgarasi-govde";
import { useEklemePaneli } from "@/components/bolum-iskeleti";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Kart,
  secimStili,
} from "@/components/ui";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  bugun,
  gunEkle,
  saatMetni,
  tarihGunleBicimle,
  tarihMetni,
} from "@/lib/tarih";
import type { HaftaRandevuVerisi } from "@/lib/randevu/hafta-verisi";
import { saatiDakikayaCevir } from "../../uzmanlar/sema";

type Hizmet = { id: string; ad: string };
type Uzman = {
  id: string;
  ad: string;
  renk: string;
  buSubede: boolean;
  hizmetIdleri: string[];
};

/**
 * §16 ↔ §17.4 — "Randevu ver…" akışı: hizmet seç → haftalık ızgarada boş bir
 * güne/saate tıkla → uzmanı onayla. Adım geçişleri yalnız istemci durumu;
 * gerçek yazma ve çakışma kontrolü `randevuVer` sunucu eyleminde (aynı
 * `lib/randevu` kuralları — `randevuEkle` ile paylaşımlı).
 */
export function RandevuPlanlamaPenceresi({
  acik,
  onKapat,
  adayId,
  veli,
  hizmetler,
  uzmanlar,
  haftaVerisiBaslangic,
}: {
  acik: boolean;
  onKapat: () => void;
  adayId: string;
  veli: { ad: string; telefon: string | null };
  hizmetler: Hizmet[];
  uzmanlar: Uzman[];
  haftaVerisiBaslangic: HaftaRandevuVerisi;
}) {
  const [hizmetId, setHizmetId] = useState("");
  const [haftaAcik, setHaftaAcik] = useState(false);
  const [secim, setSecim] = useState<{ tarih: string; saat: string } | null>(
    null,
  );
  const [hafta, setHafta] = useState(haftaVerisiBaslangic);
  const [bekliyor, basla] = useTransition();

  const seciliHizmet = hizmetler.find((h) => h.id === hizmetId);

  function kapat() {
    setHizmetId("");
    setHaftaAcik(false);
    setSecim(null);
    setHafta(haftaVerisiBaslangic);
    onKapat();
  }

  function haftayiDegistir(yon: -1 | 0 | 1) {
    const hedefGun =
      yon === 0 ? bugun() : gunEkle(hafta.sutunlar[0].gun, yon * 7);
    basla(async () => setHafta(await haftaRandevuVerisiEylemi(tarihMetni(hedefGun))));
  }

  return (
    <>
      <Pencere
        acik={acik && !haftaAcik}
        onKapat={kapat}
        baslik="Randevu ver"
        altBaslik="Önce hizmeti seçin."
        genislik="26rem"
      >
        <div className="space-y-4">
          <Alan etiket="Hizmet">
            <select
              className={secimStili}
              value={hizmetId}
              onChange={(olay) => setHizmetId(olay.target.value)}
            >
              <option value="">Seçin…</option>
              {hizmetler.map((hizmet) => (
                <option key={hizmet.id} value={hizmet.id}>
                  {hizmet.ad}
                </option>
              ))}
            </select>
          </Alan>
          <div className="flex flex-wrap gap-2">
            <Buton
              type="button"
              disabled={!hizmetId}
              onClick={() => setHaftaAcik(true)}
            >
              Devam
            </Buton>
            <Buton type="button" tur="ikincil" onClick={kapat}>
              Vazgeç
            </Buton>
          </div>
        </div>
      </Pencere>

      <Pencere
        acik={acik && haftaAcik}
        onKapat={kapat}
        baslik={`Randevu ver — ${seciliHizmet?.ad ?? ""}`}
        altBaslik="Boş bir gün ve saate dokunun."
        genislik="min(70rem, calc(100vw - 2rem))"
      >
        <div className="space-y-3">
          <Kart className="flex flex-wrap items-center gap-2 p-2">
            <Buton
              type="button"
              tur="ikincil"
              disabled={bekliyor}
              onClick={() => haftayiDegistir(-1)}
              aria-label="Önceki hafta"
            >
              ‹
            </Buton>
            <Buton
              type="button"
              tur="sade"
              disabled={bekliyor}
              onClick={() => haftayiDegistir(0)}
            >
              Bugün
            </Buton>
            <Buton
              type="button"
              tur="ikincil"
              disabled={bekliyor}
              onClick={() => haftayiDegistir(1)}
              aria-label="Sonraki hafta"
            >
              ›
            </Buton>
            <span className="font-semibold text-zinc-900">{hafta.baslik}</span>
            <Buton
              type="button"
              tur="sade"
              onClick={() => setHaftaAcik(false)}
            >
              ← Hizmeti değiştir
            </Buton>
          </Kart>

          <HaftaIzgarasiGovdesi
            sutunlar={hafta.sutunlar}
            eksen={hafta.eksen}
            bosAlanTiklanabilir
            onBosAlanaTikla={(gun, saat) =>
              setSecim({ tarih: tarihMetni(gun), saat })
            }
          />
        </div>
      </Pencere>

      {seciliHizmet && secim ? (
        <RandevuOnayFormu
          key={`${secim.tarih}-${secim.saat}`}
          adayId={adayId}
          veli={veli}
          hizmet={seciliHizmet}
          uzmanlar={uzmanlar}
          tarih={secim.tarih}
          saat={secim.saat}
          onGeriDon={() => setSecim(null)}
          onBasari={kapat}
        />
      ) : null}
    </>
  );
}

function RandevuOnayFormu({
  adayId,
  veli,
  hizmet,
  uzmanlar,
  tarih,
  saat,
  onGeriDon,
  onBasari,
}: {
  adayId: string;
  veli: { ad: string; telefon: string | null };
  hizmet: Hizmet;
  uzmanlar: Uzman[];
  tarih: string;
  saat: string;
  onGeriDon: () => void;
  onBasari: () => void;
}) {
  const { durum, eylem } = useEklemePaneli(randevuVer.bind(null, adayId));

  useEffect(() => {
    if (durum.basari) onBasari();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum.basari]);

  const uygunUzmanlar = uzmanlar.filter(
    (uzman) => uzman.buSubede && uzman.hizmetIdleri.includes(hizmet.id),
  );

  const gosterilecekGun = new Date(
    Date.UTC(
      Number(tarih.slice(0, 4)),
      Number(tarih.slice(5, 7)) - 1,
      Number(tarih.slice(8, 10)),
    ),
  );
  const dakika = saatiDakikayaCevir(saat) ?? 0;
  const baslangicSaati = new Date(gosterilecekGun.getTime() + dakika * 60_000);

  return (
    <Pencere acik onKapat={onGeriDon} baslik="Randevuyu onayla" genislik="26rem">
      <form action={eylem} className="space-y-4">
        <input type="hidden" name="hizmetId" value={hizmet.id} />
        <input type="hidden" name="tarih" value={tarih} />
        <input type="hidden" name="saat" value={saat} />

        <Kart className="space-y-1 p-3 text-sm">
          <p>
            <span className="font-semibold text-zinc-900">Zaman:</span>{" "}
            {tarihGunleBicimle(gosterilecekGun)} · {saatMetni(baslangicSaati)}
          </p>
          <p>
            <span className="font-semibold text-zinc-900">Hizmet:</span>{" "}
            {hizmet.ad}
          </p>
          <p>
            <span className="font-semibold text-zinc-900">Veli:</span>{" "}
            {veli.ad}
            {veli.telefon ? ` · ${veli.telefon}` : ""}
          </p>
        </Kart>

        <Alan etiket="Uzman" hata={durum.alanHatalari?.uzmanId}>
          <select name="uzmanId" className={secimStili} defaultValue="">
            <option value="">Seçin…</option>
            {uygunUzmanlar.map((uzman) => (
              <option key={uzman.id} value={uzman.id}>
                {uzman.ad}
              </option>
            ))}
          </select>
        </Alan>
        {uygunUzmanlar.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Bu şubede bu hizmeti verebilen aktif uzman yok.
          </p>
        ) : null}

        <Alan etiket="Not" hata={durum.alanHatalari?.not}>
          <CokSatirli name="not" rows={2} maxLength={2000} />
        </Alan>

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <div className="flex flex-wrap gap-2">
          <GonderButonu>Randevuyu kaydet</GonderButonu>
          <Buton type="button" tur="ikincil" onClick={onGeriDon}>
            Geri
          </Buton>
        </div>
      </form>
    </Pencere>
  );
}
