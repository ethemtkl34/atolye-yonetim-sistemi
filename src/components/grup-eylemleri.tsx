"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Buton, Girdi, butonStili } from "@/components/ui";
import {
  grupAdiGuncelle,
  grupDurumDegistir,
} from "@/app/koordinator/donemler/actions";
import { kulupGrupDurumDegistir } from "@/app/koordinator/kulupler/actions";

/**
 * Grup kartının eylemleri: adı düzenle + kayda kapat/aç.
 *
 * Ad düzenleme paneli kart başlığının ALTINA, tam satır olarak açılıyor:
 * düğme sırasının içinde bir girdi kutusu telefonda taşardı. `w-full` ile
 * sarmalayıcı esnek satırda kendi satırına iniyor.
 *
 * Kapalı grup listelerde "Kapalı" rozetiyle görünür ve yeni kayıt alamaz;
 * mevcut kayıtlar, oturumlar ve puanlamalar etkilenmez.
 */
export function GrupEylemleri({
  grupId,
  grupAdi,
  aktif,
  tur,
}: {
  grupId: string;
  grupAdi: string;
  aktif: boolean;
  tur: "donem" | "kulup";
}) {
  const [bekliyor, basla] = useTransition();
  const [durum, setDurum] = useState<{ hata?: string; basari?: string } | null>(
    null,
  );
  const [acik, setAcik] = useState(false);
  const [ad, setAd] = useState(grupAdi);

  const kaydet = () => {
    setDurum(null);
    basla(async () => {
      const sonuc = await grupAdiGuncelle(grupId, ad);
      setDurum(sonuc);
      // Panel yalnızca başarıda kapanıyor: hata varsa kullanıcı yazdığını
      // kaybetmeden düzeltebilsin.
      if (sonuc.basari) setAcik(false);
    });
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
      {/* Takvim ayrı sayfada: 30 haftalık bir programda gün listesi karta
          sığmaz, üstelik telafi günü eklemek kendi formunu istiyor. */}
      <Link
        href={`/koordinator/gruplar/${grupId}/takvim`}
        className={butonStili("sade")}
      >
        Takvim
      </Link>

      <Buton
        type="button"
        tur="sade"
        disabled={bekliyor}
        onClick={() => {
          setDurum(null);
          setAd(grupAdi);
          setAcik((o) => !o);
        }}
      >
        Adı düzenle
      </Buton>

      <Buton
        type="button"
        tur="sade"
        disabled={bekliyor}
        onClick={() => {
          setDurum(null);
          basla(async () => {
            const eylem =
              tur === "donem" ? grupDurumDegistir : kulupGrupDurumDegistir;
            setDurum(await eylem(grupId));
          });
        }}
      >
        {bekliyor ? "Kaydediliyor…" : aktif ? "Kayda kapat" : "Kayda aç"}
      </Buton>

      {acik ? (
        <div className="mt-2 w-full">
          <label className="block">
            <span className="sr-only">Grup adı</span>
            <Girdi
              value={ad}
              onChange={(olay) => setAd(olay.target.value)}
              onKeyDown={(olay) => {
                if (olay.key === "Enter") {
                  olay.preventDefault();
                  kaydet();
                }
                if (olay.key === "Escape") setAcik(false);
              }}
              maxLength={60}
              autoFocus
              aria-label="Grup adı"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Buton type="button" onClick={kaydet} disabled={bekliyor}>
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </Buton>
            <Buton
              type="button"
              tur="ikincil"
              disabled={bekliyor}
              onClick={() => setAcik(false)}
            >
              Vazgeç
            </Buton>
          </div>
        </div>
      ) : null}

      {durum?.hata ? (
        <div className="mt-2 w-full">
          <Bildirim tur="hata">{durum.hata}</Bildirim>
        </div>
      ) : null}
      {durum?.basari ? (
        <div className="mt-2 w-full">
          <Bildirim tur="basari">{durum.basari}</Bildirim>
        </div>
      ) : null}
    </div>
  );
}
