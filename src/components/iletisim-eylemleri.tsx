import { telBaglantisi, waBaglantisi } from "@/lib/telefon";
import { butonStili } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * §16.6 — "Ara" ve "WhatsApp" hızlı erişimi.
 *
 * Sunucu bileşeni: yalnız bağlantı çiziyor, durum tutmuyor.
 *
 * WhatsApp'ın marka yeşili BİLEREK kullanılmıyor: emerald bu panelde
 * "olumlu" anlamına ayrılmış (bkz. tasarım dili 3. kuralı), bir markanın
 * rengi için harcanamaz. Ayrım ikon ve etiketle yapılıyor.
 *
 * Numara tam değilse (eksik hane) bağlantı üretilemez ve düğme HİÇ
 * çizilmez — çalışmayan düğme, olmayan düğmeden kötüdür.
 */

function TelefonIkonu() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-[18px]"
    >
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
    </svg>
  );
}

function WhatsappIkonu() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-[18px]"
    >
      <path d="M21 11.6a8.6 8.6 0 0 1-12.6 7.6L4 20.5l1.4-4.2A8.6 8.6 0 1 1 21 11.6z" />
      <path d="M9 8.6c.4 2.7 2.4 4.9 5.1 5.6l1-1.4 1.8.9c-.2 1.2-1.3 1.9-2.4 1.7A8 8 0 0 1 7.8 9.1c-.2-1.1.5-2.2 1.7-2.4l.9 1.8-1.4.1z" />
    </svg>
  );
}

export function IletisimDugmeleri({
  telefon,
  boyut = "normal",
}: {
  telefon: string;
  /** "kucuk": liste satırındaki yuvarlak ikon çifti. */
  boyut?: "normal" | "kucuk";
}) {
  const tel = telBaglantisi(telefon);
  const wa = waBaglantisi(telefon);

  if (!tel && !wa) return null;

  if (boyut === "kucuk") {
    // Telefonda 44px dokunma hedefi; masaüstünde sıkı ölçü.
    const yuvarlak =
      "kil-buton kil-buton-ikincil grid size-11 place-items-center rounded-full sm:size-9";

    return (
      <div className="flex items-center gap-2">
        {tel ? (
          <a href={tel} className={yuvarlak} aria-label="Ara" title="Ara">
            <TelefonIkonu />
          </a>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={yuvarlak}
            aria-label="WhatsApp ile yaz"
            title="WhatsApp"
          >
            <WhatsappIkonu />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tel ? (
        <a href={tel} className={cn(butonStili("birincil"), "flex-1 gap-2 sm:flex-none")}>
          <TelefonIkonu />
          Ara
        </a>
      ) : null}
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(butonStili("ikincil"), "flex-1 gap-2 sm:flex-none")}
        >
          <WhatsappIkonu />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
