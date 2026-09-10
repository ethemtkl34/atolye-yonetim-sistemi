"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Kart, Rozet, butonStili } from "@/components/ui";
import { Pencere } from "@/components/ui-istemci";
import {
  GUN_KISA_ADLARI,
  bugun,
  gunundenGun,
  saatAraligiMetni,
  saatMetni,
  tarihGunleBicimle,
} from "@/lib/tarih";
import {
  dakikadanOran,
  type HaftaSutunu,
  type IzgaraEkseni,
} from "@/lib/randevu/izgara-verisi";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import type { EylemDurumu } from "@/lib/formlar";
import { dakikayiSaateCevir } from "../uzmanlar/sema";
import { DURUM_ADLARI, DURUM_ROZETLERI } from "./sema";
import { randevuDurumDegistir, randevuIptalEt } from "./actions";
import { IptalPenceresi } from "./iptal-penceresi";
import { RandevuEylemleri } from "./randevu-eylemleri";
import type { RandevuSatiri } from "./takvim";

/** Bir dakikanın piksel karşılığı (Izgara/Program ile aynı yoğunluk). */
const PX_PER_DK = 1.5;
/** Gün sütununun sabit genişliği; yedi gün aynı anda görünmeyince yatay kaydırma devreye girer. */
const SUTUN_GENISLIGI_REM = 9;
const ZAMAN_SUTUNU_REM = 4;

/**
 * §17.4 revizyonu — "Hafta" ızgara görünümü.
 *
 * Satır saat, sütun GÜN (eski günlere-bölünmüş tablo listesinin yerine
 * geçti). Bir günün sütununda o gün çalışan BÜTÜN uzmanların randevuları
 * yan yana durur; kimin randevusu olduğu artık bir sütun başlığından değil
 * bloğun RENGİNDEN okunuyor — bu yüzden renk burada Program görünümündekinden
 * daha DOYGUN (ton.metin arka plan, beyaz yazı), soluk pastel yetersiz
 * kalırdı. Ad yine de her zaman yazılı: renk körlüğü tek başına renge
 * güvenmeyi imkânsız kılıyor.
 *
 * Mesai/izin gölgelemesi BİLEREK yok: sütun tek bir uzmana ait değil, "bu
 * uzman bugün mesaide mi" sorusunun tek bir cevabı olmuyor. Boş hücreye
 * tıklayıp randevu açma da yok aynı sebeple — önce uzman seçilmeli, o akış
 * sayfa başındaki "Randevu aç" düğmesinde.
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
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [detay, setDetay] = useState<RandevuSatiri | null>(null);
  const [iptalHedefi, setIptalHedefi] = useState<RandevuSatiri | null>(null);
  const [bekliyor, basla] = useTransition();

  const toplamPiksel = (eksen.bitisDk - eksen.baslangicDk) * PX_PER_DK;
  const buGun = bugun();

  const saatCizgileri: number[] = [];
  for (let dk = eksen.baslangicDk; dk <= eksen.bitisDk; dk += eksen.adimDk) {
    saatCizgileri.push(dk);
  }

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
        <div className="overflow-x-auto">
          <div
            style={{
              minWidth: `${ZAMAN_SUTUNU_REM + sutunlar.length * SUTUN_GENISLIGI_REM}rem`,
            }}
          >
            {/* Bkz. Izgara (Program) bileşenindeki aynı şerh: başlık satırı
                yalnız yatayda sabit, dikey sticky sayfa kaydırmasıyla
                çakışıyordu. */}
            <div className="flex border-b border-[var(--kil-kenar)] bg-[var(--color-yuzey-50)]">
              <div
                className="sticky left-0 z-20 shrink-0 bg-[var(--color-yuzey-50)]"
                style={{ width: `${ZAMAN_SUTUNU_REM}rem` }}
              />
              {sutunlar.map((sutun) => {
                const buGunMu = sutun.gun.getTime() === buGun.getTime();
                return (
                  <div
                    key={sutun.gun.toISOString()}
                    className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5"
                    style={{ width: `${SUTUN_GENISLIGI_REM}rem` }}
                  >
                    <span
                      className={
                        buGunMu
                          ? "flex size-6 items-center justify-center rounded-full bg-marka-600 text-xs font-bold text-white"
                          : "text-sm font-bold text-zinc-800"
                      }
                    >
                      {sutun.gun.getUTCDate()}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {GUN_KISA_ADLARI[gunundenGun(sutun.gun)]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="relative flex" style={{ height: `${toplamPiksel}px` }}>
              {saatCizgileri.map((dk) => (
                <div
                  key={`cizgi-${dk}`}
                  className="absolute inset-x-0 border-t border-zinc-200"
                  style={{ top: `${dakikadanOran(dk, eksen) * 100}%` }}
                  aria-hidden
                />
              ))}

              <div
                className="sticky left-0 z-10 shrink-0 bg-[var(--color-yuzey-50)]"
                style={{ width: `${ZAMAN_SUTUNU_REM}rem` }}
              >
                <div className="relative h-full">
                  {saatCizgileri
                    .filter((dk) => dk % 60 === 0)
                    .map((dk) => (
                      <span
                        key={dk}
                        className="absolute right-2 text-xs text-zinc-500 tabular-nums"
                        style={{
                          top: `${dakikadanOran(dk, eksen) * 100}%`,
                          transform:
                            dk === eksen.baslangicDk
                              ? "translateY(0)"
                              : dk === eksen.bitisDk
                                ? "translateY(-100%)"
                                : "translateY(-50%)",
                        }}
                      >
                        {dakikayiSaateCevir(dk)}
                      </span>
                    ))}
                </div>
              </div>

              {sutunlar.map((sutun) => (
                <div
                  key={sutun.gun.toISOString()}
                  className="relative"
                  style={{ width: `${SUTUN_GENISLIGI_REM}rem` }}
                >
                  {sutun.bloklar.map(
                    ({ baslangicDk, bitisDk, randevu, lane, laneSayisi }) => {
                      const ton = uzmanRengi(randevu.uzmanRengi);
                      return (
                        <button
                          key={randevu.id}
                          type="button"
                          onClick={() => setDetay(randevu)}
                          className="kil-satir absolute overflow-hidden rounded-[var(--kil-r-sm)] p-1 text-left"
                          style={{
                            top: `${dakikadanOran(baslangicDk, eksen) * 100}%`,
                            height: `${(dakikadanOran(bitisDk, eksen) - dakikadanOran(baslangicDk, eksen)) * 100}%`,
                            left: `calc(${(lane / laneSayisi) * 100}% + 1px)`,
                            width: `calc(${100 / laneSayisi}% - 2px)`,
                            // `kil-satir` sınıfı `background` KISALTMASIYLA
                            // kendi (opak) kil gradyanını çiziyor; yalnız
                            // `backgroundColor` vermek bu gradyanın ALTINDA
                            // kalıp hiç görünmezdi. Gradyan burada elle
                            // kapatılıyor.
                            backgroundImage: "none",
                            backgroundColor: ton.metin,
                            color: "#fff",
                            opacity: randevu.durum === "IPTAL" ? 0.6 : 1,
                          }}
                        >
                          <span className="block truncate text-[0.7rem] font-semibold tabular-nums">
                            {saatMetni(randevu.baslangic)}
                          </span>
                          <span className="block truncate text-[0.65rem] font-medium">
                            {randevu.hizmetAdi}
                          </span>
                          <span className="block truncate text-[0.6rem] text-white/80">
                            {randevu.uzmanAdi}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Kart>

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
    </div>
  );
}
