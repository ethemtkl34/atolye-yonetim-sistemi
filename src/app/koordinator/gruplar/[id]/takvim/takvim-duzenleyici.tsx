"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, Girdi, Kart, Rozet } from "@/components/ui";
import {
  grupGunuEkle,
  grupGunuSil,
  grupGunuTasi,
  type TakvimDurumu,
} from "../../takvim-eylemleri";

export type TakvimGunu = {
  /** `yyyy-aa-gg` — sunucuya bu biçimde gidiyor. */
  anahtar: string;
  gosterim: string;
  haftaNumarasi: number | null;
  atolyeSayisi: number;
  puanlamaSayisi: number;
  gecmis: boolean;
};

/**
 * Grubun oturum günlerini düzenler.
 *
 * Üç işlem var ve üçü de TEK BİR GÜNÜ bütün olarak ele alıyor: taşı, sil,
 * yeni gün ekle. Bir günün yarısını ertelemek diye bir şey yok — o gün ya
 * yapılır ya yapılmaz.
 *
 * Puanlanmış günler ayırt ediliyor: taşınabilirler (puanlama oturuma bağlı,
 * tarihe değil) ama silinemezler. Silme düğmesi o satırlarda hiç çıkmıyor;
 * tıklanıp hata almak yerine baştan görünmemesi daha açık.
 */
export function TakvimDuzenleyici({
  grupId,
  gunler,
}: {
  grupId: string;
  gunler: TakvimGunu[];
}) {
  const [bekliyor, basla] = useTransition();
  const [durum, setDurum] = useState<TakvimDurumu | null>(null);
  const [tasinan, setTasinan] = useState<string | null>(null);
  const [yeniTarih, setYeniTarih] = useState("");
  const [eklenecek, setEklenecek] = useState("");

  const calistir = (islem: () => Promise<TakvimDurumu>, sonra?: () => void) => {
    setDurum(null);
    basla(async () => {
      const sonuc = await islem();
      setDurum(sonuc);
      if (sonuc.basari) sonra?.();
    });
  };

  return (
    <div className="space-y-4">
      {durum?.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum?.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Telafi günü ekle
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Seçilen güne programın bütün atölyeleri yazılır. Aynı hafta içinde
          ikinci bir gün açmak için de bunu kullanın.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-sm font-medium text-zinc-700">
              Tarih
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
                () => grupGunuEkle(grupId, eklenecek),
                () => setEklenecek(""),
              )
            }
          >
            {bekliyor ? "Ekleniyor…" : "Günü ekle"}
          </Buton>
        </div>
      </Kart>

      <div className="space-y-2">
        {gunler.length === 0 ? (
          <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
            Bu grubun takviminde hiç gün yok.
          </p>
        ) : null}

        {gunler.map((gun) => (
          <Kart key={gun.anahtar} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">
                    {gun.gosterim}
                  </span>
                  {gun.haftaNumarasi ? (
                    <Rozet tur="notr">{gun.haftaNumarasi}. hafta</Rozet>
                  ) : (
                    <Rozet tur="uyari">Telafi</Rozet>
                  )}
                  {gun.gecmis ? <Rozet tur="pasif">Geçmiş</Rozet> : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {gun.atolyeSayisi} atölye ·{" "}
                  {gun.puanlamaSayisi > 0
                    ? `${gun.puanlamaSayisi} puanlama girilmiş`
                    : "puanlama girilmemiş"}
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
                <Buton
                  type="button"
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
                {/* Puanlanmış gün silinemez: puanlamalar oturuma `Cascade`
                    ile bağlı, silme onları da götürürdü. */}
                {gun.puanlamaSayisi === 0 ? (
                  <Buton
                    type="button"
                    tur="tehlike"
                    disabled={bekliyor}
                    onClick={() =>
                      calistir(() => grupGunuSil(grupId, gun.anahtar))
                    }
                  >
                    Günü sil
                  </Buton>
                ) : null}
              </div>

              {tasinan === gun.anahtar ? (
                <div className="w-full border-t border-yuzey-100 pt-3">
                  <div className="flex flex-wrap items-end gap-2">
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
                          () => grupGunuTasi(grupId, gun.anahtar, yeniTarih),
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
                  {gun.puanlamaSayisi > 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Bu günde girilmiş {gun.puanlamaSayisi} puanlama var;
                      taşınınca onlar da yeni tarihe taşınır, silinmez.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Kart>
        ))}
      </div>
    </div>
  );
}
