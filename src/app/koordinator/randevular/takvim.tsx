"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
              <Kart className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs tracking-wide text-zinc-500 uppercase">
                        <th className="px-3 py-2.5 font-semibold">Saat</th>
                        <th className="px-3 py-2.5 font-semibold">Uzman</th>
                        <th className="px-3 py-2.5 font-semibold">Hizmet</th>
                        <th className="px-3 py-2.5 font-semibold">Danışan</th>
                        <th className="px-3 py-2.5 font-semibold">Durum</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Ücret</th>
                        <th className="w-10 px-2 py-2.5 font-semibold">
                          <span className="sr-only">İşlemler</span>
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
    <tr
      className={cn(
        "transition-colors hover:bg-zinc-50",
        iptalEdilmis && "opacity-60",
      )}
    >
      <td className="px-3 py-2.5 align-top font-semibold tabular-nums whitespace-nowrap text-zinc-900">
        {saatAraligiMetni(randevu.baslangic, randevu.bitis)}
      </td>

      <td className="px-3 py-2.5 align-top">
        {/* Uzman rengi yalnız hızlı tarama için; adı her zaman yanında
            yazılı (renk körlüğü tek başına renge güvenmeyi imkânsız
            kılıyor). Nokta yerine renkli çip: dar bir tabloda göze ilk
            çarpan şey bu olmalı, tek piksellik nokta taranırken kayboluyordu. */}
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-medium whitespace-nowrap"
          style={{ backgroundColor: ton.zemin, color: ton.metin }}
        >
          <span
            className="size-1.5 shrink-0 rounded-full bg-current"
            aria-hidden
          />
          {randevu.uzmanAdi}
        </span>
      </td>

      <td className="px-3 py-2.5 align-top">
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

      <td className="px-3 py-2.5 align-top">
        {randevu.bizim ? (
          <>
            <span className="block font-medium text-zinc-800">
              {randevu.veliAdi}
            </span>
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

      <td className="px-3 py-2.5 align-top">
        <Rozet tur={DURUM_ROZETLERI[randevu.durum]}>
          {DURUM_ADLARI[randevu.durum]}
        </Rozet>
      </td>

      <td className="px-3 py-2.5 text-right align-top font-medium tabular-nums text-zinc-800">
        {randevu.ucretKurus !== null && randevu.ucretKurus > 0
          ? paraMetni(randevu.ucretKurus)
          : "—"}
      </td>

      <td className="px-2 py-2.5 align-top">
        <RandevuIslemMenusu
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

/**
 * Satırdaki işlemleri tek bir "⋮" düğmesinin arkasına toplar.
 *
 * Eskiden dört düğme (Hatırlat/Gerçekleşti/Gelmedi/İptal) satırda YAN YANA
 * duruyordu; dar bir tablo sütununda bu hem taşıyor hem "hangisi bu satırın
 * asıl bilgisi, hangisi eylem" ayrımını bulanıklaştırıyordu. İçerik AYNI
 * `RandevuEylemleri` — Izgara'nın (Program görünümü) blok detay penceresi
 * geniş yer bulduğu için düğmeleri hâlâ açık gösteriyor, tek eylem kaynağı
 * bozulmuyor.
 */
function RandevuIslemMenusu(props: {
  randevu: RandevuSatiri;
  yazabilir: boolean;
  kurumAdi: string;
  bekliyor: boolean;
  onDurum: (durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI") => void;
  onIptal: () => void;
}) {
  const { randevu, yazabilir, onDurum, onIptal } = props;
  const [acik, setAcik] = useState(false);
  // Sabit (fixed) konumlanan panelin ekrandaki yeri — düğmenin altına ve
  // sağına hizalı, GERÇEK piksel olarak açılış anında ölçülüyor.
  const [konum, setKonum] = useState<{ top: number; right: number } | null>(
    null,
  );
  const dugmeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    function disaTikla(olay: MouseEvent) {
      const hedef = olay.target as Node;
      // Düğmenin kendisi de "dışarı" sayılırsa şu sıra yaşanır: mousedown
      // önce bu dinleyiciyi tetikleyip menüyü kapatır, ardından aynı
      // tıklamanın click olayı düğmenin onClick'ini çalıştırıp menüyü HEMEN
      // yeniden açar — kullanıcı kapatamaz. Düğme de kapsam dışı tutuluyor.
      if (panelRef.current?.contains(hedef)) return;
      if (dugmeRef.current?.contains(hedef)) return;
      setAcik(false);
    }
    function kacTusu(olay: KeyboardEvent) {
      if (olay.key === "Escape") setAcik(false);
    }
    document.addEventListener("mousedown", disaTikla);
    document.addEventListener("keydown", kacTusu);
    return () => {
      document.removeEventListener("mousedown", disaTikla);
      document.removeEventListener("keydown", kacTusu);
    };
  }, [acik]);

  // Eylem hiç yoksa (yazma yetkisi yok, başka şubenin randevusu, zaten
  // iptal) boş bir "⋮" göstermenin anlamı yok — RandevuEylemleri de aynı
  // koşulda null dönüyor, karar burada TEKRARLANIYOR ki tıklanamaz düğme
  // çizilmesin.
  if (!yazabilir || !randevu.bizim || randevu.durum === "IPTAL") return null;

  return (
    <>
      <button
        ref={dugmeRef}
        type="button"
        onClick={() => {
          if (!acik) {
            const dikdortgen = dugmeRef.current?.getBoundingClientRect();
            if (dikdortgen) {
              setKonum({
                top: dikdortgen.bottom + 4,
                right: window.innerWidth - dikdortgen.right,
              });
            }
          }
          setAcik((deger) => !deger);
        }}
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label="İşlemler"
        className={cn(
          butonStili("sade"),
          "!min-h-9 w-9 !px-0 text-base leading-none sm:!min-h-8 sm:w-8",
        )}
      >
        ⋮
      </button>

      {/* Tablonun `overflow-x-auto` kaydırma kutusu ve kartın kendi kenar
          yuvarlaması dikey taşmayı KESER — tablodaki son satırın menüsü
          hiç görünmezdi. `document.body`'ye taşınıp `position: fixed` ile
          düğmenin ölçülmüş konumuna yapıştırılıyor; bu yüzden hiçbir üst
          kapsayıcının `overflow` kuralına bağlı değil. */}
      {acik && konum
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{ top: konum.top, right: konum.right }}
              className="kil-yuzey fixed z-50 w-52 space-y-1.5 p-2"
            >
              <RandevuEylemleri
                {...props}
                onDurum={(durum) => {
                  setAcik(false);
                  onDurum(durum);
                }}
                onIptal={() => {
                  setAcik(false);
                  onIptal();
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
