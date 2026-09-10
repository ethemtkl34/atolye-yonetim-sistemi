"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Kart, Rozet, butonStili } from "@/components/ui";
import { Pencere } from "@/components/ui-istemci";
import { saatAraligiMetni, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";
import type { HaftaSutunu, IzgaraEkseni } from "@/lib/randevu/izgara-verisi";
import type { EylemDurumu } from "@/lib/formlar";
import { DURUM_ADLARI, DURUM_ROZETLERI } from "./sema";
import { randevuDurumDegistir, randevuIptalEt } from "./actions";
import { IptalPenceresi } from "./iptal-penceresi";
import { RandevuEylemleri } from "./randevu-eylemleri";
import { HaftaIzgarasiGovdesi } from "./hafta-izgarasi-govde";
import { RandevuDuzenleFormu } from "./randevu-duzenle-formu";
import {
  RandevuFormuAcici,
  type HizmetSecenegi,
  type UzmanSecenegi,
} from "./randevu-formu";
import type { RandevuSatiri } from "./takvim";

/**
 * §17.4 revizyonu — "Hafta" ızgara görünümü (sayfa kabuğu).
 *
 * Izgaranın kendisi `HaftaIzgarasiGovdesi`'nde — aday akışının randevu
 * seçicisiyle ORTAK (bkz. o dosyanın şerhi). Burada yalnız gezinme şeridi,
 * İptaller sekmesi ve tıklanan randevunun detay/eylem penceresi var.
 */
export function HaftaIzgarasi({
  baslik,
  sutunlar,
  eksen,
  iptalleriGoster,
  yazabilir,
  kurumAdi,
  toplam,
  geriYolu,
  ileriYolu,
  bugunYolu,
  iptalYolu,
  formUzmanlari,
  hizmetler,
  varsayilanTarih,
}: {
  baslik: string;
  sutunlar: HaftaSutunu<RandevuSatiri>[];
  eksen: IzgaraEkseni;
  iptalleriGoster: boolean;
  yazabilir: boolean;
  kurumAdi: string;
  toplam: number;
  geriYolu: string;
  ileriYolu: string;
  bugunYolu: string;
  iptalYolu: string;
  formUzmanlari: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  varsayilanTarih: string;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [detay, setDetay] = useState<RandevuSatiri | null>(null);
  const [iptalHedefi, setIptalHedefi] = useState<RandevuSatiri | null>(null);
  const [duzenleHedefi, setDuzenleHedefi] = useState<RandevuSatiri | null>(null);
  const [hucreSecimi, setHucreSecimi] = useState<{
    tarih: string;
    saat: string;
  } | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="space-y-4">
      {mesaj?.basari ? <Bildirim tur="basari">{mesaj.basari}</Bildirim> : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      <Kart className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <Link href={geriYolu} className={butonStili("ikincil")} aria-label="Önceki">
            ‹
          </Link>
          <Link href={bugunYolu} className={butonStili("sade")}>
            Bugün
          </Link>
          <Link href={ileriYolu} className={butonStili("ikincil")} aria-label="Sonraki">
            ›
          </Link>
          <span className="ml-1 font-semibold text-zinc-900">{baslik}</span>
          <span className="text-sm text-zinc-500">{toplam} randevu</span>
        </div>

        <Link
          href={iptalYolu}
          className={butonStili(iptalleriGoster ? "birincil" : "sade")}
        >
          {iptalleriGoster ? "Takvime dön" : "İptaller"}
        </Link>
      </Kart>

      <Kart className="overflow-hidden p-0">
        <HaftaIzgarasiGovdesi
          sutunlar={sutunlar}
          eksen={eksen}
          onBlokTikla={setDetay}
          bosAlanTiklanabilir={yazabilir}
          onBosAlanaTikla={(gun, saat) =>
            setHucreSecimi({ tarih: tarihMetni(gun), saat })
          }
        />
      </Kart>

      {/*
        Program (ızgara) görünümündeki aynı desen: dışarıdan kontrol edilen,
        boş hücreye tıklanınca açılan İKİNCİ bir `RandevuFormuAcici` — sayfa
        başlığındaki "Randevu aç" düğmesinin sahibi olduğu kendi örneğinden
        bağımsız (bkz. o dosyanın şerhi).
      */}
      <RandevuFormuAcici
        key={`${hucreSecimi?.tarih ?? ""}-${hucreSecimi?.saat ?? ""}`}
        uzmanlar={formUzmanlari}
        hizmetler={hizmetler}
        varsayilanTarih={hucreSecimi?.tarih ?? varsayilanTarih}
        varsayilanSaat={hucreSecimi?.saat}
        acik={hucreSecimi !== null}
        onAcikDegis={(acik) => {
          if (!acik) setHucreSecimi(null);
        }}
      />

      <Pencere
        acik={detay !== null}
        onKapat={() => setDetay(null)}
        baslik={detay ? saatAraligiMetni(detay.baslangic, detay.bitis) : ""}
        altBaslik={
          detay ? `${tarihGunleBicimle(detay.baslangic)} · ${detay.hizmetAdi}` : undefined
        }
        genislik="24rem"
      >
        {detay ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Rozet tur={DURUM_ROZETLERI[detay.durum]}>
                {DURUM_ADLARI[detay.durum]}
              </Rozet>
              {detay.seriDeMi ? <Rozet tur="notr">Seri</Rozet> : null}
              {detay.bizim ? null : <Rozet tur="pasif">{detay.subeAdi}</Rozet>}
            </div>

            <p className="text-sm text-zinc-600">
              {detay.uzmanAdi}
              {detay.bizim ? (
                <>
                  {" · "}
                  {detay.veliAdi}
                  {detay.ogrenciAdi ? ` · ${detay.ogrenciAdi}` : ""}
                </>
              ) : (
                <span className="text-zinc-500"> · diğer şube</span>
              )}
            </p>

            {detay.not ? <p className="text-xs text-zinc-500">{detay.not}</p> : null}
            {detay.iptalNotu ? (
              <p className="text-xs text-zinc-500">İptal notu: {detay.iptalNotu}</p>
            ) : null}

            <RandevuEylemleri
              randevu={detay}
              yazabilir={yazabilir}
              kurumAdi={kurumAdi}
              bekliyor={bekliyor}
              onDurum={(durum) => {
                const hedef = detay;
                setDetay(null);
                basla(async () =>
                  setMesaj(await randevuDurumDegistir(hedef.id, durum)),
                );
              }}
              onIptal={() => {
                setIptalHedefi(detay);
                setDetay(null);
              }}
              onDuzenle={() => {
                setDuzenleHedefi(detay);
                setDetay(null);
              }}
            />
          </div>
        ) : null}
      </Pencere>

      <IptalPenceresi
        randevu={iptalHedefi}
        onKapat={() => setIptalHedefi(null)}
        onOnayla={(kapsam, not) => {
          const hedef = iptalHedefi;
          setIptalHedefi(null);
          if (!hedef) return;
          basla(async () => setMesaj(await randevuIptalEt(hedef.id, kapsam, not)));
        }}
      />

      <RandevuDuzenleFormu
        randevu={duzenleHedefi}
        uzmanlar={formUzmanlari}
        hizmetler={hizmetler}
        onKapat={() => setDuzenleHedefi(null)}
      />
    </div>
  );
}
