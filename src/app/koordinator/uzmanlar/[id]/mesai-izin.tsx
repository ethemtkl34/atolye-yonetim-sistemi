"use client";

import { useActionState, useState, useTransition } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  Girdi,
  Kart,
  Rozet,
  kartBasligiStili,
  secimStili,
} from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { izinEkle, izinSil, mesaiEkle, mesaiSil } from "../actions";
import { GUNLER } from "../sema";

export type MesaiSatiri = {
  id: string;
  gun: (typeof GUNLER)[number];
  subeId: string;
  subeAdi: string;
  baslangic: string;
  bitis: string;
};

export type IzinSatiri = {
  id: string;
  metin: string;
  sebep: string | null;
  gecmis: boolean;
};

export type SubeSecenegi = { id: string; ad: string };

const GUN_ADLARI: Record<(typeof GUNLER)[number], string> = {
  PAZARTESI: "Pazartesi",
  SALI: "Salı",
  CARSAMBA: "Çarşamba",
  PERSEMBE: "Perşembe",
  CUMA: "Cuma",
  CUMARTESI: "Cumartesi",
  PAZAR: "Pazar",
};

/**
 * §17.3 — Uzmanın haftalık mesaisi ve izinleri.
 *
 * İkisi de randevu takviminin kapısı: mesai dışına ve izin aralığına randevu
 * AÇILAMAZ (uyarı değil, engel). Bu yüzden ekran ikisini yan yana gösteriyor
 * — "neden bu saate randevu açamıyorum" sorusunun cevabı tek yerde.
 */
export function MesaiVeIzin({
  uzmanId,
  mesailer,
  izinler,
  subeler,
  duzenleyebilir,
}: {
  uzmanId: string;
  mesailer: MesaiSatiri[];
  izinler: IzinSatiri[];
  subeler: SubeSecenegi[];
  duzenleyebilir: boolean;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="space-y-4">
      {mesaj?.basari ? <Bildirim tur="basari">{mesaj.basari}</Bildirim> : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Kart className="space-y-3 p-4">
          <h2 className={kartBasligiStili}>Haftalık mesai</h2>
          <p className="text-sm text-zinc-600">
            Randevu yalnız bu aralıklara açılabilir. Şube başına ayrı: aynı
            uzman salı Ümraniye&apos;de, perşembe Güneşli&apos;de olabilir.
          </p>

          {mesailer.length === 0 ? (
            <BosDurum
              baslik="Mesai tanımlı değil"
              aciklama="Mesai girilmeden bu uzmana randevu açılamaz."
            />
          ) : (
            <ul className="kil-bolmeli">
              {GUNLER.filter((gun) =>
                mesailer.some((mesai) => mesai.gun === gun),
              ).map((gun) => (
                <li key={gun} className="py-2">
                  <p className="text-sm font-semibold text-zinc-800">
                    {GUN_ADLARI[gun]}
                  </p>
                  <div className="mt-1 space-y-1">
                    {mesailer
                      .filter((mesai) => mesai.gun === gun)
                      .map((mesai) => (
                        <div
                          key={mesai.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-zinc-700">
                            {mesai.baslangic}–{mesai.bitis}{" "}
                            <Rozet tur="notr">{mesai.subeAdi}</Rozet>
                          </span>
                          {duzenleyebilir ? (
                            <Buton
                              type="button"
                              tur="sade"
                              disabled={bekliyor}
                              onClick={() =>
                                basla(async () =>
                                  setMesaj(await mesaiSil(uzmanId, mesai.id)),
                                )
                              }
                            >
                              Kaldır
                            </Buton>
                          ) : null}
                        </div>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {duzenleyebilir ? (
            <MesaiFormu uzmanId={uzmanId} subeler={subeler} />
          ) : null}
        </Kart>

        <Kart className="space-y-3 p-4">
          <h2 className={kartBasligiStili}>İzinler</h2>
          <p className="text-sm text-zinc-600">
            İzin aralığına randevu açılamaz. Seans sayısı ve ciro raporlarına
            karışmaz — izin bir seans değildir.
          </p>

          {izinler.length === 0 ? (
            <BosDurum baslik="Kayıtlı izin yok" />
          ) : (
            <ul className="kil-bolmeli">
              {izinler.map((izin) => (
                <li
                  key={izin.id}
                  className="flex items-start justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800">
                      {izin.metin}
                      {izin.gecmis ? (
                        <>
                          {" "}
                          <Rozet tur="pasif">Geçmiş</Rozet>
                        </>
                      ) : null}
                    </p>
                    {izin.sebep ? (
                      <p className="text-xs text-zinc-500">{izin.sebep}</p>
                    ) : null}
                  </div>
                  {duzenleyebilir ? (
                    <Buton
                      type="button"
                      tur="sade"
                      disabled={bekliyor}
                      onClick={() =>
                        basla(async () =>
                          setMesaj(await izinSil(uzmanId, izin.id)),
                        )
                      }
                    >
                      Kaldır
                    </Buton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {duzenleyebilir ? <IzinFormu uzmanId={uzmanId} /> : null}
        </Kart>
      </div>
    </div>
  );
}

function MesaiFormu({
  uzmanId,
  subeler,
}: {
  uzmanId: string;
  subeler: SubeSecenegi[];
}) {
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    mesaiEkle.bind(null, uzmanId),
    {},
  );

  return (
    <form action={gonder} className="kil-oyuk space-y-3 p-3">
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Alan etiket="Gün" hata={durum.alanHatalari?.gun}>
          <select name="gun" className={secimStili} defaultValue="PAZARTESI">
            {GUNLER.map((gun) => (
              <option key={gun} value={gun}>
                {GUN_ADLARI[gun]}
              </option>
            ))}
          </select>
        </Alan>

        <Alan etiket="Şube" hata={durum.alanHatalari?.subeId}>
          <select name="subeId" className={secimStili}>
            {subeler.map((sube) => (
              <option key={sube.id} value={sube.id}>
                {sube.ad}
              </option>
            ))}
          </select>
        </Alan>

        <Alan etiket="Başlangıç" hata={durum.alanHatalari?.baslangic}>
          <Girdi name="baslangic" type="time" defaultValue="09:00" required />
        </Alan>

        <Alan etiket="Bitiş" hata={durum.alanHatalari?.bitis}>
          <Girdi name="bitis" type="time" defaultValue="18:00" required />
        </Alan>
      </div>

      <GonderButonu tur="ikincil">Mesai ekle</GonderButonu>
    </form>
  );
}

function IzinFormu({ uzmanId }: { uzmanId: string }) {
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    izinEkle.bind(null, uzmanId),
    {},
  );
  const [tamGun, setTamGun] = useState(true);

  return (
    <form action={gonder} className="kil-oyuk space-y-3 p-3">
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Alan etiket="Başlangıç" hata={durum.alanHatalari?.baslangicTarih}>
          <Girdi name="baslangicTarih" type="date" required />
        </Alan>

        <Alan etiket="Bitiş" hata={durum.alanHatalari?.bitisTarih}>
          <Girdi name="bitisTarih" type="date" required />
        </Alan>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="tamGun"
          checked={tamGun}
          onChange={(olay) => setTamGun(olay.target.checked)}
          className="size-4"
        />
        Tam gün (bitiş günü dahil)
      </label>

      {tamGun ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Alan etiket="Başlangıç saati" hata={durum.alanHatalari?.baslangicSaat}>
            <Girdi name="baslangicSaat" type="time" defaultValue="13:00" />
          </Alan>
          <Alan etiket="Bitiş saati" hata={durum.alanHatalari?.bitisSaat}>
            <Girdi name="bitisSaat" type="time" defaultValue="18:00" />
          </Alan>
        </div>
      )}

      <Alan etiket="Sebep (isteğe bağlı)" hata={durum.alanHatalari?.sebep}>
        <Girdi name="sebep" maxLength={200} placeholder="Yıllık izin" />
      </Alan>

      <GonderButonu tur="ikincil">İzin ekle</GonderButonu>
    </form>
  );
}
