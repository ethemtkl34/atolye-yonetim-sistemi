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
                "rounded-md px-2.5 py-1 text-sm",
                secili === secenek.deger
                  ? "bg-marka-50 font-medium text-marka-700"
                  : "text-zinc-600 hover:bg-zinc-100",
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
