"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bildirim,
  Buton,
  Kart,
  Rozet,
  butonStili,
} from "@/components/ui";
import { saatAraligiMetni, tarihGunleBicimle } from "@/lib/tarih";
import {
  anketMetni,
  hatirlatmaMetni,
  whatsappMesajBaglantisi,
} from "@/lib/randevu/mesaj";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import { cn } from "@/lib/utils";
import type { EylemDurumu } from "@/lib/formlar";
import { paraMetni } from "../uzmanlar/sema";
import { DURUM_ADLARI, DURUM_ROZETLERI, type Gorunum } from "./sema";
import { randevuDurumDegistir, randevuIptalEt } from "./actions";
import { IptalPenceresi } from "./iptal-penceresi";

export type RandevuSatiri = {
  id: string;
  /** Oturumdaki şubenin randevusu mu — değilse danışan bilgisi gizli. */
  bizim: boolean;
  subeAdi: string;
  baslangic: Date;
  bitis: Date;
  durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI" | "IPTAL";
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
              grup.randevular.map((randevu) => (
                <RandevuKarti
                  key={randevu.id}
                  randevu={randevu}
                  yazabilir={yazabilir}
                  kurumAdi={kurumAdi}
                  bekliyor={bekliyor}
                  onDurum={(durum) =>
                    basla(async () =>
                      setMesaj(await randevuDurumDegistir(randevu.id, durum)),
                    )
                  }
                  onIptal={() => setIptalHedefi(randevu)}
                />
              ))
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

function RandevuKarti({
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

  /**
   * §17.6 — Hatırlatma ve anket bağlantıları.
   *
   * Otomatik gönderim yok: bağlantı WhatsApp'ı hazır metinle açıyor, gönder
   * tuşuna kullanıcı basıyor. Numara tam değilse bağlantı `null` dönüyor ve
   * düğme HİÇ çizilmiyor — çalışmayan düğme, olmayan düğmeden kötüdür.
   *
   * Hatırlatma PLANLI randevuda, anket GERÇEKLEŞEN seansta anlamlı; ikisi
   * aynı anda çıkmıyor.
   */
  const mesajBilgisi = randevu.veliAdi
    ? {
        kurumAdi,
        veliAdi: randevu.veliAdi,
        cocukAdi: randevu.ogrenciAdi,
        hizmetAdi: randevu.hizmetAdi,
        uzmanAdi: randevu.uzmanAdi,
        baslangic: randevu.baslangic,
      }
    : null;

  const hatirlatmaYolu =
    mesajBilgisi && randevu.durum === "PLANLANDI"
      ? whatsappMesajBaglantisi(randevu.veliTelefon, hatirlatmaMetni(mesajBilgisi))
      : null;

  const anketYolu =
    mesajBilgisi && randevu.durum === "GERCEKLESTI"
      ? whatsappMesajBaglantisi(randevu.veliTelefon, anketMetni(mesajBilgisi))
      : null;

  return (
    <Kart
      className={cn("flex flex-wrap items-start gap-3 p-3", iptalEdilmis && "opacity-70")}
    >
      {/* Uzman rengi yalnız hızlı tarama için; adı her zaman yanında yazılı
          (renk körlüğü tek başına renge güvenmeyi imkânsız kılıyor). */}
      <span
        className="mt-1 h-9 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: ton.metin }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums text-zinc-900">
            {saatAraligiMetni(randevu.baslangic, randevu.bitis)}
          </span>
          <span className="text-zinc-800">{randevu.hizmetAdi}</span>
          <Rozet tur={DURUM_ROZETLERI[randevu.durum]}>
            {DURUM_ADLARI[randevu.durum]}
          </Rozet>
          {randevu.seriDeMi ? <Rozet tur="notr">Seri</Rozet> : null}
          {randevu.bizim ? null : (
            <Rozet tur="pasif">{randevu.subeAdi}</Rozet>
          )}
        </div>

        <p className="mt-0.5 text-sm text-zinc-600">
          {randevu.uzmanAdi}
          {randevu.bizim ? (
            <>
              {" · "}
              {randevu.veliAdi}
              {randevu.ogrenciAdi ? ` · ${randevu.ogrenciAdi}` : ""}
              {randevu.ucretKurus !== null && randevu.ucretKurus > 0
                ? ` · ${paraMetni(randevu.ucretKurus)}`
                : ""}
            </>
          ) : (
            // Başka şubenin randevusu: yalnız "o saat dolu" bilgisi (§17.7).
            <span className="text-zinc-500"> · diğer şube</span>
          )}
        </p>

        {randevu.not ? (
          <p className="mt-1 text-xs text-zinc-500">{randevu.not}</p>
        ) : null}
        {randevu.iptalNotu ? (
          <p className="mt-1 text-xs text-zinc-500">
            İptal notu: {randevu.iptalNotu}
          </p>
        ) : null}
      </div>

      {yazabilir && randevu.bizim && !iptalEdilmis ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hatirlatmaYolu ? (
            <a
              href={hatirlatmaYolu}
              target="_blank"
              rel="noopener noreferrer"
              className={butonStili("sade")}
            >
              Hatırlat
            </a>
          ) : null}
          {anketYolu ? (
            <a
              href={anketYolu}
              target="_blank"
              rel="noopener noreferrer"
              className={butonStili("sade")}
            >
              Anket
            </a>
          ) : null}
          {randevu.durum === "GERCEKLESTI" ? null : (
            <Buton
              type="button"
              tur="ikincil"
              disabled={bekliyor}
              onClick={() => onDurum("GERCEKLESTI")}
            >
              Gerçekleşti
            </Buton>
          )}
          {randevu.durum === "GELMEDI" ? null : (
            <Buton
              type="button"
              tur="sade"
              disabled={bekliyor}
              onClick={() => onDurum("GELMEDI")}
            >
              Gelmedi
            </Buton>
          )}
          <Buton type="button" tur="tehlike" disabled={bekliyor} onClick={onIptal}>
            İptal
          </Buton>
        </div>
      ) : null}
    </Kart>
  );
}
