import Link from "next/link";
import { baglantiStili } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Dashboard'un kart bileşenleri — veri bilmezler, yalnızca çizerler. */

/** Bölüm başlığı; sağdaki bağlantı verilirse "Tümü" olarak çıkar. */
export function BolumBasligi({
  baslik,
  aciklama,
  yol,
}: {
  baslik: string;
  aciklama?: string;
  yol?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{baslik}</h2>
        {aciklama ? (
          <p className="mt-0.5 text-xs text-zinc-500">{aciklama}</p>
        ) : null}
      </div>
      {yol ? (
        <Link href={yol} className={baglantiStili}>
          Tümü
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Bekleyen iş kartı.
 *
 * Sıfır ile sıfır olmayan ayrımı kartın tamamında görünür: iş varsa turuncu
 * şerit, turuncu sayı ve turuncu zemin; yoksa kart sessizleşip yerinde kalır.
 * Kartı gizlemek daha temiz görünürdü ama "0 dolan grup" bilgisi de bir
 * cevaptır ve kartların yer değiştirmesi ekranı okunmaz hale getiriyordu.
 * Turuncu yalnızca şerit ve sayıda; küçük metin için beyaz üstünde kontrastı
 * yetmediğinden başlık ve alt bilgi nötr kalıyor.
 */
export function IsKarti({
  baslik,
  deger,
  birim,
  altBilgi,
  yol,
}: {
  baslik: string;
  deger: number;
  birim: string;
  altBilgi: string;
  /**
   * Kartın açtığı liste. Verilmezse kart tıklanamaz olur.
   *
   * Ölü bağlantı vermektense tıklanamaz kart daha dürüst: "Güncelliğini
   * yitiren rapor" kartı bir süre `/koordinator/raporlar?suzgec=eski`
   * adresine gidiyordu ama o sayfa kaldırılmıştı; yönlendirme süzgeci
   * düşürüp kullanıcıyı öğrenci listesine atıyor, "hangi raporlar" sorusu
   * cevapsız kalıyordu.
   */
  yol?: string;
}) {
  const dikkat = deger > 0;

  const govde = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          dikkat ? "bg-vurgu-600" : "bg-yuzey-200",
        )}
      />
      <p className="text-sm text-zinc-600">{baslik}</p>
      <p aria-hidden className="mt-1 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-3xl font-semibold tabular-nums",
            dikkat ? "text-vurgu-800" : "text-zinc-400",
          )}
        >
          {deger}
        </span>
        <span className="text-xs text-zinc-500">{birim}</span>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{altBilgi}</p>
    </>
  );

  const temel = cn(
    "relative flex flex-col overflow-hidden rounded-lg border p-4 pl-5 shadow-[0_1px_2px_rgba(91,16,53,0.04)]",
    dikkat ? "border-vurgu-200 bg-vurgu-50" : "border-yuzey-200 bg-white",
  );

  if (!yol) {
    // Tıklanamaz kart imleç değiştirmiyor ve vurgu almıyor: tıklanabilir
    // görünüp hiçbir şey yapmamak, hiç tıklanabilir görünmemekten kötü.
    return (
      <div className={temel} aria-label={`${baslik}: ${deger} ${birim}`}>
        {govde}
      </div>
    );
  }

  return (
    <Link
      href={yol}
      aria-label={`${baslik}: ${deger} ${birim}`}
      className={cn(
        temel,
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600",
        dikkat ? "hover:bg-vurgu-100" : "hover:bg-marka-50",
      )}
    >
      {govde}
    </Link>
  );
}

/** Durum şeridinin tek hücresi — bağlam bilgisi, iş değil. */
export function DurumOgesi({
  baslik,
  deger,
  yol,
}: {
  baslik: string;
  deger: number;
  /** Verilmezse hücre tıklanamaz olur — açılacak bir liste yoksa. */
  yol?: string;
}) {
  const govde = (
    <>
      <span className="block text-xs text-zinc-500">{baslik}</span>
      <span className="mt-0.5 block text-xl font-semibold tabular-nums text-marka-800">
        {deger}
      </span>
    </>
  );

  const yerlesim =
    "px-4 py-3 first:rounded-t-lg last:rounded-b-lg sm:first:rounded-l-lg sm:first:rounded-tr-none sm:last:rounded-r-lg sm:last:rounded-bl-none";

  if (!yol) {
    return (
      <div className={yerlesim} aria-label={`${baslik}: ${deger}`}>
        {govde}
      </div>
    );
  }

  return (
    <Link
      href={yol}
      aria-label={`${baslik}: ${deger}`}
      className={cn(
        yerlesim,
        "transition-colors hover:bg-marka-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600",
      )}
    >
      {govde}
    </Link>
  );
}
