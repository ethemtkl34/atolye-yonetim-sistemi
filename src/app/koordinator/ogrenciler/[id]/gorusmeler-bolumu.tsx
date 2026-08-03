"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
  Rozet,
  secimStili,
} from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import {
  gorusmeEkle,
  gorusmeSil,
  type GorusmeEylemDurumu,
} from "./gorusme-eylemleri";

/**
 * Psikolog görüşmeleri bölümü.
 *
 * GİZLİLİK: Bu bileşen yalnızca koordinatör profil sayfasında kullanılır;
 * görüşme verisi stajyer ekranlarının hiçbirine gitmez (sağlık bilgisi
 * kuralının aynısı).
 *
 * Ekleme satır içi açılır form — rapor penceresindeki `<dialog>` makinesi
 * çok görünümlü, URL parametreli bir akış içindi; dört alanlık form için o
 * ağırlık gereksiz.
 */

export type GorusmeSatiri = {
  id: string;
  tarih: Date;
  gorusmeciAdi: string;
  tur: "PSIKOLOG" | "KOORDINATOR";
  not: string;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

const TUR_ETIKETLERI: Record<GorusmeSatiri["tur"], string> = {
  PSIKOLOG: "Psikolog",
  KOORDINATOR: "Koordinatör",
};

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Görüşmeyi kaydet"}
    </Buton>
  );
}

export function GorusmelerBolumu({
  ogrenciId,
  gorusmeler,
  bugunMetni,
}: {
  ogrenciId: string;
  gorusmeler: GorusmeSatiri[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni: string;
}) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<GorusmeEylemDurumu, FormData>(
    gorusmeEkle.bind(null, ogrenciId),
    {},
  );

  // Başarıdan sonra form kapanır (render sırasında durum ayarlamadan —
  // grup ekleme formundaki desenle aynı).
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  const [silmeDurumu, setSilmeDurumu] = useState<GorusmeEylemDurumu>({});
  const [siliniyor, silmeyeBasla] = useTransition();

  function sil(gorusme: GorusmeSatiri) {
    if (
      !window.confirm(
        `${tarihBicimle(gorusme.tarih)} tarihli görüşme (${gorusme.gorusmeciAdi}) silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }
    silmeyeBasla(async () => setSilmeDurumu(await gorusmeSil(gorusme.id)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Görüşmeler
          {gorusmeler.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {gorusmeler.length} görüşme
            </span>
          ) : null}
        </h2>
        {!acik ? (
          <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
            + Görüşme ekle
          </Buton>
        ) : null}
      </div>

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {silmeDurumu.basari ? (
        <Bildirim tur="basari">{silmeDurumu.basari}</Bildirim>
      ) : null}
      {silmeDurumu.hata ? (
        <Bildirim tur="hata">{silmeDurumu.hata}</Bildirim>
      ) : null}

      {acik ? (
        <Kart className="space-y-4 p-4">
          <p className="text-sm text-zinc-600">
            Görüşme notları yalnızca koordinatörlere görünür; stajyerler bu
            bölümü hiçbir ekranda göremez.
          </p>

          <form action={eylem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Alan
                etiket="Görüşme tarihi"
                ipucu="Bugün için olduğu gibi bırakın."
                hata={durum.alanHatalari?.tarih}
              >
                <Girdi name="tarih" type="date" defaultValue={bugunMetni} />
              </Alan>

              <Alan
                etiket="Görüşmeyi yapan"
                hata={durum.alanHatalari?.gorusmeciAdi}
              >
                <Girdi
                  name="gorusmeciAdi"
                  placeholder="Örn. Psk. Ayşe Yılmaz"
                  autoFocus
                />
              </Alan>

              <Alan etiket="Görüşmeci" hata={durum.alanHatalari?.tur}>
                <select
                  name="tur"
                  defaultValue="PSIKOLOG"
                  className={secimStili}
                >
                  <option value="PSIKOLOG">Psikolog</option>
                  <option value="KOORDINATOR">Koordinatör</option>
                </select>
              </Alan>
            </div>

            <Alan etiket="Görüşme notu" hata={durum.alanHatalari?.not}>
              <CokSatirli
                name="not"
                rows={4}
                placeholder="Görüşmede konuşulanlar, gözlemler, öneriler…"
              />
            </Alan>

            {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

            <div className="flex flex-wrap items-center gap-2">
              <KaydetButonu />
              <Buton type="button" tur="sade" onClick={() => setAcik(false)}>
                Vazgeç
              </Buton>
            </div>
          </form>
        </Kart>
      ) : null}

      {gorusmeler.length === 0 && !acik ? (
        <BosDurum
          baslik="Henüz görüşme kaydı yok."
          aciklama="Psikolog veya koordinatör görüşmelerini buradan ekleyebilirsiniz. Notlar stajyerlere görünmez."
        />
      ) : (
        <div className="space-y-2">
          {gorusmeler.map((gorusme) => (
            <Kart key={gorusme.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">
                    {tarihBicimle(gorusme.tarih)}
                  </span>
                  <Rozet tur={gorusme.tur === "PSIKOLOG" ? "notr" : "pasif"}>
                    {TUR_ETIKETLERI[gorusme.tur]}
                  </Rozet>
                  <span className="text-sm text-zinc-600">
                    {gorusme.gorusmeciAdi}
                  </span>
                </div>
                <Buton
                  type="button"
                  tur="sade"
                  disabled={siliniyor}
                  onClick={() => sil(gorusme)}
                >
                  Sil
                </Buton>
              </div>

              {/* Not tam metin: koordinatör okumak için giriyor, kırpmak
                  okuma deneyimini bozar. Satır sonları korunur. */}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {gorusme.not}
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                Ekleyen: {gorusme.ekleyen ?? "—"} ·{" "}
                {tarihBicimle(gorusme.eklenmeTarihi)}
              </p>
            </Kart>
          ))}
        </div>
      )}
    </div>
  );
}
