"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Kart, Rozet, butonStili } from "@/components/ui";
import { Pencere } from "@/components/ui-istemci";
import {
  saatAraligiMetni,
  saatMetni,
  tarihGunleBicimle,
} from "@/lib/tarih";
import {
  dakikadanOran,
  mesaiDisiBloklari,
  orandanDakika,
  type IzgaraEkseni,
  type IzgaraSutunu,
} from "@/lib/randevu/izgara-verisi";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import type { EylemDurumu } from "@/lib/formlar";
import { dakikayiSaateCevir } from "../uzmanlar/sema";
import { DURUM_ADLARI, DURUM_ROZETLERI } from "./sema";
import { randevuDurumDegistir, randevuIptalEt } from "./actions";
import { IptalPenceresi } from "./iptal-penceresi";
import { RandevuEylemleri } from "./randevu-eylemleri";
import { RandevuDuzenleFormu } from "./randevu-duzenle-formu";
import type { RandevuSatiri } from "./takvim";
import {
  RandevuFormuAcici,
  type HizmetSecenegi,
  type UzmanSecenegi,
} from "./randevu-formu";

/** Bir dakikanın piksel karşılığı — 30 dk'lık en kısa seans bile ≥44px olsun. */
const PX_PER_DK = 1.5;
/** Sütunların sabit genişliği; çok uzman olduğunda yatay kaydırma devreye girer. */
const SUTUN_GENISLIGI_REM = 11;
const ZAMAN_SUTUNU_REM = 4;

/**
 * §17.4 — "Program" ızgara görünümü.
 *
 * Satır saat, sütun uzman. Randevu bloğu gerçek süresince piksel yüksekliği
 * kaplar (mutlak konumlandırma) — tek hücre = tek randevu DEĞİL, çünkü
 * seanslar 30–120 dk arasında değişiyor (bkz. `docs/PROJECT_SPEC.md` §17.4).
 *
 * Kaydırma: tek `overflow-x-auto` sarmalayıcı içinde başlık satırı
 * `sticky top-0`, saat sütunu `sticky left-0` — iç içe dikey kaydırma
 * konteyneri YOK, sayfa normal kaydırılır (mobilde çift kaydırma sorunundan
 * kaçınmak için).
 */
export function Izgara({
  baslik,
  uzmanlar,
  sutunlar,
  eksen,
  yazabilir,
  kurumAdi,
  toplam,
  geriYolu,
  ileriYolu,
  bugunYolu,
  formUzmanlari,
  hizmetler,
  varsayilanTarih,
}: {
  baslik: string;
  uzmanlar: { id: string; ad: string; renk: string }[];
  sutunlar: IzgaraSutunu<RandevuSatiri>[];
  eksen: IzgaraEkseni;
  yazabilir: boolean;
  kurumAdi: string;
  toplam: number;
  geriYolu: string;
  ileriYolu: string;
  bugunYolu: string;
  formUzmanlari: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  varsayilanTarih: string;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [detay, setDetay] = useState<RandevuSatiri | null>(null);
  const [iptalHedefi, setIptalHedefi] = useState<RandevuSatiri | null>(null);
  const [duzenleHedefi, setDuzenleHedefi] = useState<RandevuSatiri | null>(null);
  const [hucreSecimi, setHucreSecimi] = useState<{
    uzmanId: string;
    saat: string;
  } | null>(null);
  const [bekliyor, basla] = useTransition();

  const toplamPiksel = (eksen.bitisDk - eksen.baslangicDk) * PX_PER_DK;

  const saatCizgileri: number[] = [];
  for (let dk = eksen.baslangicDk; dk <= eksen.bitisDk; dk += eksen.adimDk) {
    saatCizgileri.push(dk);
  }

  function hucreyeTikla(
    olay: React.MouseEvent<HTMLDivElement>,
    sutun: IzgaraSutunu<RandevuSatiri>,
  ) {
    if (!yazabilir) return;
    const kutu = olay.currentTarget.getBoundingClientRect();
    const oran = (olay.clientY - kutu.top) / kutu.height;
    const dakika = orandanDakika(oran, eksen);

    const mesaiIcinde = sutun.calismaBloklari.some(
      (blok) => dakika >= blok.baslangicDk && dakika < blok.bitisDk,
    );
    const izinli = sutun.izinBloklari.some(
      (blok) => dakika >= blok.baslangicDk && dakika < blok.bitisDk,
    );
    if (!mesaiIcinde || izinli) return;

    setHucreSecimi({ uzmanId: sutun.uzmanId, saat: dakikayiSaateCevir(dakika) });
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
      </Kart>

      {uzmanlar.length === 0 ? (
        <div className="kil-bos p-8 text-center">
          <p className="text-sm font-medium text-zinc-600">
            Bu şubede çalışan aktif uzman yok
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Program görünümü için önce Uzmanlar ekranından kadro tanımlayın.
          </p>
        </div>
      ) : (
        <Kart className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div
              style={{
                minWidth: `${ZAMAN_SUTUNU_REM + uzmanlar.length * SUTUN_GENISLIGI_REM}rem`,
              }}
            >
              {/*
                Başlık satırı YATAYDA sabit kalır (sol köşe hücresi hâlâ
                `sticky left-0`), ama DİKEYDE sabitlenmiyor: `overflow-x-auto`
                olan sarmalayıcı tarayıcıda otomatik olarak dikey scroll
                bağlamı da açıyor (CSS Overflow: "biri visible değilse diğeri
                de auto sayılır") — bu yüzden `sticky top-0` sayfaya değil bu
                kartın kendi (görünmeyen) iç kaydırmasına göre çalışırdı ve
                kart kaydırılınca kaybolurdu. Basit ve öngörülebilir olan:
                dikey sticky'den vazgeçmek.
              */}
              <div className="flex border-b border-[var(--kil-kenar)] bg-[var(--color-yuzey-50)]">
                <div
                  className="sticky left-0 z-20 shrink-0 bg-[var(--color-yuzey-50)]"
                  style={{ width: `${ZAMAN_SUTUNU_REM}rem` }}
                />
                {uzmanlar.map((uzman) => {
                  const ton = uzmanRengi(uzman.renk);
                  return (
                    <div
                      key={uzman.id}
                      className="flex shrink-0 items-center gap-1.5 px-2 py-2"
                      style={{ width: `${SUTUN_GENISLIGI_REM}rem` }}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ton.metin }}
                        aria-hidden
                      />
                      <span className="truncate text-sm font-semibold text-zinc-800">
                        {uzman.ad}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Gövde: saat ekseni + uzman sütunları. */}
              <div className="relative flex" style={{ height: `${toplamPiksel}px` }}>
                {/* Saat çizgileri — sütunların ARKASINDA, tek seferde, tam genişlik. */}
                {saatCizgileri.map((dk) => (
                  <div
                    key={`cizgi-${dk}`}
                    className="absolute inset-x-0 border-t border-zinc-200"
                    style={{ top: `${dakikadanOran(dk, eksen) * 100}%` }}
                    aria-hidden
                  />
                ))}

                {/* Saat etiketleri — sola sabit. */}
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
                            // Uçlardaki etiket eksenin dışına taşmasın diye
                            // yalnız aradakiler dikeyde ortalanır.
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

                {uzmanlar.map((uzman) => {
                  const sutun = sutunlar.find((s) => s.uzmanId === uzman.id);
                  if (!sutun) return null;
                  const ton = uzmanRengi(uzman.renk);
                  const bosluklar = sutun.mesaiYok
                    ? [{ baslangicDk: eksen.baslangicDk, bitisDk: eksen.bitisDk }]
                    : mesaiDisiBloklari(sutun.calismaBloklari, eksen);

                  return (
                    <div
                      key={uzman.id}
                      className={cnTikla(yazabilir && !sutun.mesaiYok)}
                      style={{ width: `${SUTUN_GENISLIGI_REM}rem` }}
                      onClick={(olay) => hucreyeTikla(olay, sutun)}
                    >
                      {bosluklar.map((blok, i) => (
                        <div
                          key={`bos-${i}`}
                          className="kil-oyuk absolute inset-x-0.5"
                          style={{
                            top: `${dakikadanOran(blok.baslangicDk, eksen) * 100}%`,
                            height: `${(dakikadanOran(blok.bitisDk, eksen) - dakikadanOran(blok.baslangicDk, eksen)) * 100}%`,
                          }}
                        />
                      ))}

                      {sutun.izinBloklari.map((blok, i) => (
                        <div
                          key={`izin-${i}`}
                          className="kil-oyuk absolute inset-x-0.5 flex items-center justify-center"
                          style={{
                            top: `${dakikadanOran(blok.baslangicDk, eksen) * 100}%`,
                            height: `${(dakikadanOran(blok.bitisDk, eksen) - dakikadanOran(blok.baslangicDk, eksen)) * 100}%`,
                          }}
                        >
                          <span className="text-[0.65rem] font-medium text-zinc-500">
                            İzinli
                          </span>
                        </div>
                      ))}

                      {sutun.randevular.map(({ baslangicDk, bitisDk, randevu }) => (
                        <button
                          key={randevu.id}
                          type="button"
                          onClick={(olay) => {
                            olay.stopPropagation();
                            setDetay(randevu);
                          }}
                          className="kil-satir absolute inset-x-0.5 overflow-hidden rounded-[var(--kil-r-sm)] p-1 text-left"
                          style={{
                            top: `${dakikadanOran(baslangicDk, eksen) * 100}%`,
                            height: `${(dakikadanOran(bitisDk, eksen) - dakikadanOran(baslangicDk, eksen)) * 100}%`,
                            // `kil-satir`in kendi (opak) `background` kısaltması
                            // bunun ALTINDA kalıp uzman rengini soluklaştırırdı
                            // — bkz. `hafta-izgarasi.tsx`'teki aynı şerh.
                            backgroundImage: "none",
                            backgroundColor: ton.zemin,
                            color: ton.metin,
                            opacity: randevu.durum === "IPTAL" ? 0.6 : 1,
                          }}
                        >
                          <span className="block truncate text-[0.7rem] font-semibold tabular-nums">
                            {saatMetni(randevu.baslangic)}
                          </span>
                          <span className="block truncate text-[0.65rem]">
                            {randevu.hizmetAdi}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Kart>
      )}

      <RandevuFormuAcici
        key={`${hucreSecimi?.uzmanId ?? ""}-${hucreSecimi?.saat ?? ""}`}
        uzmanlar={formUzmanlari}
        hizmetler={hizmetler}
        varsayilanTarih={varsayilanTarih}
        varsayilanUzmanId={hucreSecimi?.uzmanId}
        varsayilanSaat={hucreSecimi?.saat}
        acik={hucreSecimi !== null}
        onAcikDegis={(acik) => {
          if (!acik) setHucreSecimi(null);
        }}
      />

      <Pencere
        acik={detay !== null}
        onKapat={() => setDetay(null)}
        baslik={
          detay ? saatAraligiMetni(detay.baslangic, detay.bitis) : ""
        }
        altBaslik={detay ? `${tarihGunleBicimle(detay.baslangic)} · ${detay.hizmetAdi}` : undefined}
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

function cnTikla(tiklanabilir: boolean): string {
  return tiklanabilir ? "relative cursor-pointer" : "relative";
}
