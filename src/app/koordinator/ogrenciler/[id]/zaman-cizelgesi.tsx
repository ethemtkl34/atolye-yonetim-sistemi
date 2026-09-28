import { BosDurum, Rozet } from "@/components/ui";
import type { OlayTuru, ZamanCizelgesiOlayi } from "@/lib/ogrenci-zaman-cizelgesi";
import { saatMetni, tarihGunleBicimle } from "@/lib/tarih";

/**
 * §6.5 — Öğrencinin zaman çizelgesi (28 Eylül 2026).
 *
 * Tek sütun, eskiden yeniye: ilk temastan bugüne. Sol tarafta tarih, sağda
 * ne olduğu. Aynı güne düşen olaylarda tarih TEKRAR YAZILMIYOR — dört satır
 * boyunca aynı günü okumak, gerçekten kaç ayrı gün olduğunu gizliyordu.
 *
 * Nokta rengi olayın kaynağını söylüyor: aday yolu, randevu/seans, program
 * kaydı, görüşme, belge. Metni okumadan da "bu çocukta ne ağırlıkta ne var"
 * sorusuna cevap veriyor.
 */

const NOKTA_RENKLERI: Record<OlayTuru, string> = {
  aday: "bg-amber-500",
  adayAsama: "bg-amber-400",
  adayDonusum: "bg-amber-600",
  ogrenciKaydi: "bg-marka-600",
  randevuVerildi: "bg-sky-400",
  kayit: "bg-emerald-500",
  terapiOnGorusme: "bg-violet-400",
  seans: "bg-sky-600",
  terapi: "bg-violet-600",
  veliGorusmesi: "bg-violet-500",
  zekaTesti: "bg-teal-600",
  kayitIptal: "bg-zinc-400",
  rapor: "bg-rose-500",
  arsivRapor: "bg-rose-400",
};

export function ZamanCizelgesi({ olaylar }: { olaylar: ZamanCizelgesiOlayi[] }) {
  if (olaylar.length === 0) {
    return (
      <BosDurum
        baslik="Hareket yok"
        aciklama="Bu öğrenci için henüz kayıtlı bir randevu, seans ya da program kaydı yok."
      />
    );
  }

  /**
   * Gün başlıkları render'dan ÖNCE hesaplanıyor: döngü içinde bir değişkeni
   * güncellemek React derleyicisinin kuralına takılıyor
   * ("Cannot reassign variable after render completes") ve render'ı saf
   * olmaktan çıkarıyor.
   */
  const satirlar = olaylar.map((olay, sira) => {
    const gun = tarihGunleBicimle(olay.an);
    const onceki = sira === 0 ? null : tarihGunleBicimle(olaylar[sira - 1].an);
    return { olay, gun, gunDegisti: gun !== onceki };
  });

  return (
    <ol className="space-y-1">
      {satirlar.map(({ olay, gun, gunDegisti }) => {
        return (
          <li key={olay.id} className="flex gap-3">
            <div className="w-32 shrink-0 pt-1 text-right">
              {gunDegisti ? (
                <span className="text-xs font-semibold text-zinc-700">{gun}</span>
              ) : null}
            </div>

            {/* Çizgi ve nokta: sütunun kendisi `relative` değil, çizgi
                elemanın tam yüksekliğini alsın diye esnek kutuda. */}
            <div className="flex w-3 shrink-0 flex-col items-center">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${NOKTA_RENKLERI[olay.tur]}`}
                aria-hidden
              />
              <span className="w-px flex-1 bg-[var(--kil-kenar)]" aria-hidden />
            </div>

            <div className="min-w-0 flex-1 pb-3">
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-900">
                <span className="font-medium">{olay.baslik}</span>
                {olay.ilkMi ? <Rozet tur="olumlu">İlk</Rozet> : null}
                {olay.rozet ? <Rozet tur="notr">{olay.rozet}</Rozet> : null}
                {olay.baskaSube ? <Rozet tur="pasif">{olay.baskaSube}</Rozet> : null}
              </p>
              {olay.ayrinti || !olay.gunBazli ? (
                <p className="text-xs text-zinc-500">
                  {[olay.gunBazli ? null : saatMetni(olay.an), olay.ayrinti]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
