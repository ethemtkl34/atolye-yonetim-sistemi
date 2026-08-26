import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Liste ekranlarının sayfa şeridi.
 *
 * Süzgeçlerle aynı ilke (bkz. `suzgec.tsx`): sıradan GET bağlantıları. Sayfa
 * numarası adres satırında durur, sonuç paylaşılabilir ve geri tuşu beklendiği
 * gibi çalışır. İstemci durumu yok, bu yüzden sunucu bileşeni olarak kalıyor.
 *
 * SÜZGEÇ DEĞİŞİNCE SAYFA SIFIRLANIR: süzgeç bağlantıları ve arama formu
 * `sayfa` parametresini hiç taşımıyor, dolayısıyla düşüyor. Taşınsaydı iki
 * sayfalık bir sonuç kümesinin 9. sayfasında boş ekran görülürdü.
 */

/** Adres satırındaki sayfa parametresinin adı — okuyan ve yazan taraf ortak. */
export const SAYFA_ANAHTARI = "sayfa";

/** Adres parametresinden 1 tabanlı sayfa numarası; bozuk değer 1'e düşer. */
export function sayfaNumarasiCoz(ham: unknown): number {
  const sayi = Number(typeof ham === "string" ? ham : "");
  return Number.isInteger(sayi) && sayi >= 1 ? sayi : 1;
}

/**
 * Görünecek sayfa numaraları; araya "…" girer.
 *
 * Kenarlar (ilk ve son) her zaman durur ki 9 sayfalık bir listede sona tek
 * tıkla gidilebilsin. Ortadaki pencere geçerli sayfanın iki yanı.
 */
function sayfaDizisi(sayfa: number, sayfaSayisi: number): (number | "...")[] {
  const PENCERE = 2;
  const goster = new Set<number>([1, sayfaSayisi]);
  for (let i = sayfa - PENCERE; i <= sayfa + PENCERE; i += 1) {
    if (i >= 1 && i <= sayfaSayisi) goster.add(i);
  }

  const sirali = [...goster].sort((a, b) => a - b);
  const sonuc: (number | "...")[] = [];
  let onceki = 0;
  for (const numara of sirali) {
    if (onceki && numara - onceki > 1) sonuc.push("...");
    sonuc.push(numara);
    onceki = numara;
  }
  return sonuc;
}

/** Bağlantı adresi; 1. sayfada parametre hiç yazılmaz (temiz adres). */
function sayfaYolu(
  temelYol: string,
  digerler: Record<string, string>,
  sayfa: number,
): string {
  const parametreler = new URLSearchParams(digerler);
  if (sayfa > 1) parametreler.set(SAYFA_ANAHTARI, String(sayfa));
  const sorgu = parametreler.toString();
  return sorgu ? `${temelYol}?${sorgu}` : temelYol;
}

// Süzgeç çipleriyle aynı ölçüler: telefonda 44px hedef, masaüstünde sıkı.
const CIP =
  "inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full px-3.5 text-sm transition-shadow sm:min-h-[2.25rem] sm:min-w-[2.25rem] sm:px-3 sm:py-1";

export function Sayfalama({
  temelYol,
  sayfa,
  sayfaSayisi,
  digerler = {},
}: {
  temelYol: string;
  /** Geçerli sayfa, 1 tabanlı. */
  sayfa: number;
  sayfaSayisi: number;
  /** Adreste korunacak süzgeç ve arama parametreleri. */
  digerler?: Record<string, string>;
}) {
  // Tek sayfa varsa şerit hiç çizilmez: gidilecek bir yer yok.
  if (sayfaSayisi <= 1) return null;

  const numaralar = sayfaDizisi(sayfa, sayfaSayisi);

  return (
    <nav
      aria-label="Sayfalar"
      className="flex flex-wrap items-center justify-center gap-1"
    >
      {sayfa > 1 ? (
        <Link
          href={sayfaYolu(temelYol, digerler, sayfa - 1)}
          rel="prev"
          className={cn(CIP, "font-medium text-zinc-600 hover:bg-white/70")}
        >
          ← Önceki
        </Link>
      ) : null}

      {numaralar.map((numara, sira) =>
        numara === "..." ? (
          // Atlanan aralık bir bağlantı değil; ekran okuyucuya da
          // okutulmuyor, komşu numaralar zaten aralığı anlatıyor.
          <span
            key={`bosluk-${sira}`}
            aria-hidden
            className="px-1 text-sm text-zinc-400"
          >
            …
          </span>
        ) : (
          <Link
            key={numara}
            href={sayfaYolu(temelYol, digerler, numara)}
            aria-current={numara === sayfa ? "page" : undefined}
            aria-label={`Sayfa ${numara}`}
            className={cn(
              CIP,
              // Geçerli sayfa zemine GÖMÜLÜ durur (kil kuralı: basılı olan
              // içeri gider), diğerleri düz.
              numara === sayfa
                ? "kil-cip font-semibold text-marka-700"
                : "font-medium text-zinc-600 hover:bg-white/70",
            )}
          >
            {numara}
          </Link>
        ),
      )}

      {sayfa < sayfaSayisi ? (
        <Link
          href={sayfaYolu(temelYol, digerler, sayfa + 1)}
          rel="next"
          className={cn(CIP, "font-medium text-zinc-600 hover:bg-white/70")}
        >
          Sonraki →
        </Link>
      ) : null}
    </nav>
  );
}
