"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, Girdi, Rozet } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import {
  kulupGunuEkle,
  kulupGunuSil,
  kulupGununuTasi,
} from "../takvim-eylemleri";

export type KulupGunu = {
  /** `yyyy-aa-gg` — sunucuya bu biçimde gidiyor. */
  anahtar: string;
  gosterim: string;
  haftaNo: number;
  puanlamaSayisi: number;
  mufredatSayisi: number;
  gecmis: boolean;
};

/**
 * Kulübün ortak gün listesini düzenler (grup takvim düzenleyicisinin kulüp
 * ölçeğindeki karşılığı). Buradaki bir değişiklik kulübün BÜTÜN gruplarına
 * uygulanır ve gün sırası değişirse müfredat da günüyle birlikte kayar;
 * tek grubu ilgilendiren ertelemeler grubun kendi takvim sayfasında kalır.
 *
 * Puanlanmış günler silinemez (silme düğmesi hiç çıkmaz), taşınabilir.
 * Müfredatı girilmiş bir günü silmek onay ister — girdiler de gider.
 */
export function KulupTakvimDuzenleyici({
  kulupId,
  gunler,
}: {
  kulupId: string;
  gunler: KulupGunu[];
}) {
  const [bekliyor, basla] = useTransition();
  const [durum, setDurum] = useState<EylemDurumu | null>(null);
  const [tasinan, setTasinan] = useState<string | null>(null);
  const [yeniTarih, setYeniTarih] = useState("");
  const [eklenecek, setEklenecek] = useState("");

  const calistir = (islem: () => Promise<EylemDurumu>, sonra?: () => void) => {
    setDurum(null);
    basla(async () => {
      const sonuc = await islem();
      setDurum(sonuc);
      if (sonuc.basari) sonra?.();
    });
  };

  return (
    <div className="mt-3 space-y-3">
      {durum?.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum?.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <ol className="divide-y divide-yuzey-100">
        {gunler.map((gun) => (
          <li key={gun.anahtar} className="py-2.5">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900">
                    {gun.haftaNo}. gün · {gun.gosterim}
                  </span>
                  {gun.gecmis ? <Rozet tur="pasif">Geçmiş</Rozet> : null}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {gun.puanlamaSayisi > 0
                    ? `${gun.puanlamaSayisi} puanlama girilmiş`
                    : "puanlama girilmemiş"}
                  {gun.mufredatSayisi > 0
                    ? ` · ${gun.mufredatSayisi} müfredat konusu`
                    : ""}
                </p>
              </div>

              <div className="-ml-3 flex shrink-0 items-center gap-1 sm:ml-0">
                <Buton
                  tur="sade"
                  disabled={bekliyor}
                  onClick={() => {
                    setDurum(null);
                    setYeniTarih(gun.anahtar);
                    setTasinan(tasinan === gun.anahtar ? null : gun.anahtar);
                  }}
                >
                  Tarihi değiştir
                </Buton>
                {/* Puanlanmış gün silinemez: puanlamalar oturuma bağlı, silme
                    onları da götürürdü. Düğme hiç çıkmıyor. */}
                {gun.puanlamaSayisi === 0 ? (
                  <Buton
                    tur="tehlike"
                    disabled={bekliyor}
                    onClick={() => {
                      const uyari =
                        gun.mufredatSayisi > 0
                          ? `${gun.gosterim} bütün grupların takviminden silinecek; o günün ${gun.mufredatSayisi} müfredat konusu da gider. Devam edilsin mi?`
                          : `${gun.gosterim} bütün grupların takviminden silinecek. Devam edilsin mi?`;
                      if (window.confirm(uyari)) {
                        calistir(() => kulupGunuSil(kulupId, gun.anahtar));
                      }
                    }}
                  >
                    Sil
                  </Buton>
                ) : null}
              </div>
            </div>

            {tasinan === gun.anahtar ? (
              <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-yuzey-100 pt-3">
                <label className="block">
                  <span className="block text-sm font-medium text-zinc-700">
                    Yeni tarih
                  </span>
                  <span className="mt-1 block">
                    <Girdi
                      type="date"
                      value={yeniTarih}
                      onChange={(olay) => setYeniTarih(olay.target.value)}
                      autoFocus
                      className="sm:w-52"
                    />
                  </span>
                </label>
                <Buton
                  type="button"
                  disabled={bekliyor || !yeniTarih}
                  onClick={() =>
                    calistir(
                      () => kulupGununuTasi(kulupId, gun.anahtar, yeniTarih),
                      () => setTasinan(null),
                    )
                  }
                >
                  {bekliyor ? "Taşınıyor…" : "Taşı"}
                </Buton>
                <Buton
                  type="button"
                  tur="ikincil"
                  disabled={bekliyor}
                  onClick={() => setTasinan(null)}
                >
                  Vazgeç
                </Buton>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2 border-t border-yuzey-100 pt-3">
        <label className="block">
          <span className="block text-sm font-medium text-zinc-700">
            Gün ekle
          </span>
          <span className="mt-1 block">
            <Girdi
              type="date"
              value={eklenecek}
              onChange={(olay) => setEklenecek(olay.target.value)}
              className="sm:w-52"
            />
          </span>
        </label>
        <Buton
          type="button"
          disabled={bekliyor || !eklenecek}
          onClick={() =>
            calistir(
              () => kulupGunuEkle(kulupId, eklenecek),
              () => setEklenecek(""),
            )
          }
        >
          {bekliyor ? "Ekleniyor…" : "Günü ekle"}
        </Buton>
      </div>
    </div>
  );
}
