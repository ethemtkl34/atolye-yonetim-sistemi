"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Kart, Rozet, butonStili } from "@/components/ui";
import { saatAraligiMetni, tarihGunleBicimle } from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import { cn } from "@/lib/utils";
import type { EylemDurumu } from "@/lib/formlar";
import { paraMetni } from "../uzmanlar/sema";
import { DURUM_ADLARI, DURUM_ROZETLERI, type Gorunum } from "./sema";
import { randevuDurumDegistir, randevuIptalEt } from "./actions";
import { IptalPenceresi } from "./iptal-penceresi";
import { RandevuEylemleri } from "./randevu-eylemleri";

export type RandevuSatiri = {
  id: string;
  /** Oturumdaki şubenin randevusu mu — değilse danışan bilgisi gizli. */
  bizim: boolean;
  subeAdi: string;
  baslangic: Date;
  bitis: Date;
  durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI" | "IPTAL";
  /** Program (ızgara) görünümünün sütun anahtarı. */
  uzmanId: string;
  uzmanAdi: string;
  uzmanRengi: string;
  hizmetAdi: string;
  seriDeMi: boolean;
  veliAdi: string | null;
  veliTelefon: string | null;
  ogrenciAdi: string | null;
  not: string | null;
  iptalNotu: string | null;
  /** İndirim düşülmüş tutar; başka şubede null. */
  ucretKurus: number | null;
};

export type GunGrubu = { gun: Date; randevular: RandevuSatiri[] };

/**
 * §17.4 — Takvim listesi.
 *
 * Gün, hafta ve ay görünümü aynı bileşen: fark yalnız kaç gün gösterildiği.
 * Randevusu olmayan günler de çiziliyor — doluluk ancak boşluğun görünmesiyle
 * okunuyor. Ay görünümünde boş günler tek satıra iniyor, yoksa otuz satırlık
 * boşluk listeyi kullanılamaz hâle getirirdi.
 */
export function Takvim({
  baslik,
  gorunum,
  gruplar,
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
  gorunum: Gorunum;
  gruplar: GunGrubu[];
  iptalleriGoster: boolean;
  yazabilir: boolean;
  /** Mesaj metinlerinin imzası (§17.6). */
  kurumAdi: string;
  toplam: number;
  geriYolu: string;
  ileriYolu: string;
  bugunYolu: string;
  iptalYolu: string;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [iptalHedefi, setIptalHedefi] = useState<RandevuSatiri | null>(null);
  const [bekliyor, basla] = useTransition();

  // Ay görünümünde boş günler tek satıra iner (bkz. bileşen şerhi).
  const gosterilecek =
    gorunum === "ay" ? gruplar.filter((grup) => grup.randevular.length > 0) : gruplar;

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
          <span className="text-sm text-zinc-500">
            {toplam} randevu
          </span>
        </div>

        <Link
          href={iptalYolu}
          className={butonStili(iptalleriGoster ? "birincil" : "sade")}
        >
          {iptalleriGoster ? "Takvime dön" : "İptaller"}
        </Link>
      </Kart>

      <div className="space-y-3">
        {gosterilecek.map((grup) => (
          <div key={grup.gun.toISOString()} className="space-y-1.5">
            <h3 className="px-1 text-sm font-semibold text-zinc-700">
              {tarihGunleBicimle(grup.gun)}
              {grup.randevular.length > 0 ? (
                <span className="ml-2 font-normal text-zinc-500">
                  {grup.randevular.length} randevu
                </span>
              ) : null}
            </h3>

            {grup.randevular.length === 0 ? (
              <p className="kil-oyuk px-3 py-2 text-sm text-zinc-500">
                Randevu yok
              </p>
            ) : (
              <Kart className="p-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                        <th className="py-2 pr-3 font-semibold">Saat</th>
                        <th className="py-2 pr-3 font-semibold">Uzman</th>
                        <th className="py-2 pr-3 font-semibold">Hizmet</th>
                        <th className="py-2 pr-3 font-semibold">Danışan</th>
                        <th className="py-2 pr-3 font-semibold">Durum</th>
                        <th className="py-2 pr-3 text-right font-semibold">Ücret</th>
                        <th className="py-2 font-semibold">
                          <span className="sr-only">Eylemler</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="kil-bolmeli">
                      {grup.randevular.map((randevu) => (
                        <RandevuTabloSatiri
                          key={randevu.id}
                          randevu={randevu}
                          yazabilir={yazabilir}
                          kurumAdi={kurumAdi}
                          bekliyor={bekliyor}
                          onDurum={(durum) =>
                            basla(async () =>
                              setMesaj(
                                await randevuDurumDegistir(randevu.id, durum),
                              ),
                            )
                          }
                          onIptal={() => setIptalHedefi(randevu)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Kart>
            )}
          </div>
        ))}
      </div>

      <IptalPenceresi
        randevu={iptalHedefi}
        onKapat={() => setIptalHedefi(null)}
        onOnayla={(kapsam, not) => {
          const hedef = iptalHedefi;
          setIptalHedefi(null);
          if (!hedef) return;
          basla(async () =>
            setMesaj(await randevuIptalEt(hedef.id, kapsam, not)),
          );
        }}
      />
    </div>
  );
}

function RandevuTabloSatiri({
  randevu,
  yazabilir,
  kurumAdi,
  bekliyor,
  onDurum,
  onIptal,
}: {
  randevu: RandevuSatiri;
  yazabilir: boolean;
  kurumAdi: string;
  bekliyor: boolean;
  onDurum: (durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI") => void;
  onIptal: () => void;
}) {
  const ton = uzmanRengi(randevu.uzmanRengi);
  const iptalEdilmis = randevu.durum === "IPTAL";

  return (
    <tr className={cn(iptalEdilmis && "opacity-60")}>
      <td className="py-2 pr-3 align-top font-semibold tabular-nums whitespace-nowrap text-zinc-900">
        {saatAraligiMetni(randevu.baslangic, randevu.bitis)}
      </td>

      <td className="py-2 pr-3 align-top">
        {/* Uzman rengi yalnız hızlı tarama için; adı her zaman yanında
            yazılı (renk körlüğü tek başına renge güvenmeyi imkânsız
            kılıyor). */}
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: ton.metin }}
            aria-hidden
          />
          <span className="text-zinc-800">{randevu.uzmanAdi}</span>
        </span>
      </td>

      <td className="py-2 pr-3 align-top">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-zinc-800">{randevu.hizmetAdi}</span>
          {randevu.seriDeMi ? <Rozet tur="notr">Seri</Rozet> : null}
          {randevu.bizim ? null : (
            <Rozet tur="pasif">{randevu.subeAdi}</Rozet>
          )}
        </span>
        {randevu.not ? (
          <p className="mt-1 text-xs text-zinc-500">{randevu.not}</p>
        ) : null}
        {randevu.iptalNotu ? (
          <p className="mt-1 text-xs text-zinc-500">
            İptal notu: {randevu.iptalNotu}
          </p>
        ) : null}
      </td>

      <td className="py-2 pr-3 align-top">
        {randevu.bizim ? (
          <>
            <span className="block text-zinc-800">{randevu.veliAdi}</span>
            {randevu.ogrenciAdi ? (
              <span className="block text-xs text-zinc-500">
                {randevu.ogrenciAdi}
              </span>
            ) : null}
          </>
        ) : (
          // Başka şubenin randevusu: yalnız "o saat dolu" bilgisi (§17.7).
          <span className="text-zinc-500">diğer şube</span>
        )}
      </td>

      <td className="py-2 pr-3 align-top">
        <Rozet tur={DURUM_ROZETLERI[randevu.durum]}>
          {DURUM_ADLARI[randevu.durum]}
        </Rozet>
      </td>

      <td className="py-2 pr-3 text-right align-top tabular-nums text-zinc-700">
        {randevu.ucretKurus !== null && randevu.ucretKurus > 0
          ? paraMetni(randevu.ucretKurus)
          : "—"}
      </td>

      <td className="py-2 align-top">
        <RandevuEylemleri
          randevu={randevu}
          yazabilir={yazabilir}
          kurumAdi={kurumAdi}
          bekliyor={bekliyor}
          onDurum={onDurum}
          onIptal={onIptal}
        />
      </td>
    </tr>
  );
}
