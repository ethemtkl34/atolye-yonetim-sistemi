"use client";

import { GUN_KISA_ADLARI, bugun, gunundenGun, saatMetni } from "@/lib/tarih";
import {
  dakikadanOran,
  orandanDakika,
  type HaftaSutunu,
  type IzgaraEkseni,
} from "@/lib/randevu/izgara-verisi";
import { blokYazisi, uzmanRengi } from "@/lib/uzman-renkleri";
import { dakikayiSaateCevir } from "../uzmanlar/sema";
import type { RandevuSatiri } from "./takvim";

/** Bir dakikanın piksel karşılığı (Izgara/Program ile aynı yoğunluk). */
const PX_PER_DK = 1.5;
/** Gün sütununun sabit genişliği; yedi gün aynı anda görünmeyince yatay kaydırma devreye girer. */
const SUTUN_GENISLIGI_REM = 9;
const ZAMAN_SUTUNU_REM = 4;

/**
 * Haftalık ızgaranın ortak gövdesi — sütun başlıkları, saat çizgileri ve
 * randevu blokları. `randevular/page.tsx`'teki salt-okunur `HaftaIzgarasi`
 * (bkz. o dosya) ve aday akışının randevu seçicisi (`randevu-planlama.tsx`)
 * AYNI bileşeni kullanır ki tek bir yerde çizilen bir ızgara iki farklı
 * görünüşe sapmasın.
 *
 * `bosAlanTiklanabilir` YALNIZ aday seçicisinde `true`: orada henüz uzman
 * belli değil, gün sütununun boş bir yerine tıklamak "bu gün ve saati
 * seçtim" demek — hangi uzman olduğu tıklamadan SONRAKİ küçük onay
 * formunda belirleniyor. Sayfa görünümünde (`HaftaIzgarasi`) bu prop hiç
 * verilmez; oradaki tıklama hâlâ yalnız var olan bloklar üzerinde çalışır.
 */
export function HaftaIzgarasiGovdesi({
  sutunlar,
  eksen,
  bosAlanTiklanabilir = false,
  onBlokTikla,
  onBosAlanaTikla,
}: {
  sutunlar: HaftaSutunu<RandevuSatiri>[];
  eksen: IzgaraEkseni;
  bosAlanTiklanabilir?: boolean;
  onBlokTikla?: (randevu: RandevuSatiri) => void;
  onBosAlanaTikla?: (gun: Date, saat: string) => void;
}) {
  const toplamPiksel = (eksen.bitisDk - eksen.baslangicDk) * PX_PER_DK;
  const buGun = bugun();

  const saatCizgileri: number[] = [];
  for (let dk = eksen.baslangicDk; dk <= eksen.bitisDk; dk += eksen.adimDk) {
    saatCizgileri.push(dk);
  }

  function bosAlanaTikla(olay: React.MouseEvent<HTMLDivElement>, gun: Date) {
    if (!bosAlanTiklanabilir) return;
    const kutu = olay.currentTarget.getBoundingClientRect();
    const oran = Math.max(0, Math.min(1, (olay.clientY - kutu.top) / kutu.height));
    const dakika = orandanDakika(oran, eksen);
    onBosAlanaTikla?.(gun, dakikayiSaateCevir(dakika));
  }

  return (
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
              className={bosAlanTiklanabilir ? "relative cursor-pointer" : "relative"}
              style={{ width: `${SUTUN_GENISLIGI_REM}rem` }}
              onClick={(olay) => bosAlanaTikla(olay, sutun.gun)}
            >
              {sutun.bloklar.map(
                ({ baslangicDk, bitisDk, randevu, lane, laneSayisi }) => {
                  const ton = uzmanRengi(randevu.uzmanRengi);
                  return (
                    <button
                      key={randevu.id}
                      type="button"
                      onClick={(olay) => {
                        olay.stopPropagation();
                        onBlokTikla?.(randevu);
                      }}
                      className="kil-satir absolute overflow-hidden rounded-[var(--kil-r-sm)] p-1 text-left"
                      style={{
                        top: `${dakikadanOran(baslangicDk, eksen) * 100}%`,
                        height: `${(dakikadanOran(bitisDk, eksen) - dakikadanOran(baslangicDk, eksen)) * 100}%`,
                        left: `calc(${(lane / laneSayisi) * 100}% + 1px)`,
                        width: `calc(${100 / laneSayisi}% - 2px)`,
                        // `kil-satir` sınıfı `background` KISALTMASIYLA kendi
                        // (opak) kil gradyanını çiziyor; yalnız
                        // `backgroundColor` vermek bu gradyanın ALTINDA
                        // kalıp hiç görünmezdi.
                        backgroundImage: "none",
                        backgroundColor: ton.blok,
                        // Yazı rengi SABİT DEĞİL: kurumsal paletteki açık
                        // tonlarda (sarı, yeşil, turkuaz) beyaz okunmuyor
                        // (bkz. `blokYazisi` şerhi).
                        color: blokYazisi(ton.blok),
                        opacity: randevu.durum === "IPTAL" ? 0.6 : 1,
                      }}
                    >
                      <span className="block truncate text-[0.7rem] font-semibold tabular-nums">
                        {saatMetni(randevu.baslangic)}
                      </span>
                      <span className="block truncate text-[0.65rem] font-medium">
                        {randevu.hizmetAdi}
                      </span>
                      <span className="block truncate text-[0.6rem] opacity-80">
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
  );
}
