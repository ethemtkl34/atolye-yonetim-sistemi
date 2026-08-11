import Link from "next/link";
import { Kart } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Liste ekranlarının süzgeçleri.
 *
 * Süzgeç sıradan GET bağlantılarıyla çalışır: seçim adres satırında durur,
 * sonuç paylaşılabilir ve geri tuşu beklendiği gibi davranır. Dashboard
 * kartları da aynı adresleri kullanır — kart tıklanınca liste zaten doğru
 * süzgeçle açılır.
 */

export type SuzgecSecenegi = {
  deger: string;
  etiket: string;
};

// Ailenin açılır liste varyantı — ayrı dosyada, çünkü "use client" gerektirir
// (bkz. suzgec-secici.tsx). Buradan yeniden dışa aktarılır ki çağıran sayfalar
// süzgeç ailesini tek modülden görsün.
export { SuzgecSecici } from "@/components/suzgec-secici";

export function SuzgecCubugu({ children }: { children: React.ReactNode }) {
  return (
    <Kart className="flex flex-wrap items-center gap-4 p-3">{children}</Kart>
  );
}

export function SuzgecGrubu({
  etiket,
  temelYol,
  anahtar,
  secenekler,
  secili,
  digerler = {},
}: {
  etiket: string;
  /** Süzgecin bağlandığı sayfa, örn. "/koordinator/gruplar". */
  temelYol: string;
  /** Bu grubun adres parametresi, örn. "kapsam". */
  anahtar: string;
  secenekler: readonly SuzgecSecenegi[];
  secili: string;
  /** Adreste korunacak diğer süzgeçler. */
  digerler?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-500">{etiket}:</span>
      <div className="flex flex-wrap gap-1">
        {secenekler.map((secenek) => {
          const parametreler = new URLSearchParams({
            ...digerler,
            [anahtar]: secenek.deger,
          });

          return (
            <Link
              key={secenek.deger}
              href={`${temelYol}?${parametreler.toString()}`}
              aria-current={secili === secenek.deger ? "page" : undefined}
              className={cn(
                // Telefonda 44px yüksekliğinde bir hedef; masaüstünde eski
                // sıkı ölçü. Süzgeç çipleri neredeyse her liste ekranında var
                // ve 28px'ti — yan yana duran iki çipten yanlışını seçmek
                // parmakla fazlasıyla kolaydı.
                "inline-flex min-h-[2.75rem] items-center rounded-full px-3.5 text-sm transition-shadow",
                "sm:min-h-[2.25rem] sm:px-3 sm:py-1",
                // Seçili süzgeç zemine GÖMÜLÜ, seçilmeyenler düz: hangisinin
                // basılı olduğu renkten önce dokudan okunuyor.
                secili === secenek.deger
                  ? "kil-cip font-semibold text-marka-700"
                  : "font-medium text-zinc-600 hover:bg-white/70",
              )}
            >
              {secenek.etiket}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
