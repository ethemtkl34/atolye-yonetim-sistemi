import type { BantBilgisi } from "@/lib/rapor-bantlari";

/**
 * Bir ölçümün kademesini gösteren şerit.
 *
 * Kademe İKİ kanaldan okunur: rengin yanında dolu segment sayısı da artar
 * (1 = düşük, 3 = yüksek). Renk körlüğü olan bir okuyucu ya da gri basılmış
 * bir çıktı kademeyi segmentlerden çıkarabilir. Bu yüzden segmentler süs
 * değil; renk kaldırılsa bilgi hâlâ ayakta kalır.
 *
 * Sayı basılmaz (§11 kararı): veliye "2,4" gibi bir değer göstermek çocuğa
 * yapıştırılmış bir not gibi okunuyor. Kademe adı yeterli.
 */
export function KademeGostergesi({
  bant,
  etiketli = true,
}: {
  bant: BantBilgisi;
  /** Yalnız segmentler isteniyorsa (dar tablo hücreleri) kapatılır. */
  etiketli?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center gap-[3px]"
        role="img"
        aria-label={`Kademe: ${bant.etiket}`}
      >
        {[1, 2, 3].map((sira) => (
          <span
            key={sira}
            aria-hidden="true"
            className="h-2.5 w-3 rounded-[2px]"
            style={{
              backgroundColor: sira <= bant.dolu ? bant.renk : "#e4e4e7",
            }}
          />
        ))}
      </span>

      {etiketli ? (
        <span
          className="kil-cip px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: bant.zemin, color: bant.renk }}
        >
          {bant.etiket}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Kademesi hesaplanamamış ölçüm — "0 puan" değil, "ölçülemedi" demektir.
 * §11.3 gereği bu durum olumsuz bir kademe gibi gösterilmez.
 */
export function KademeYok() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
        {[1, 2, 3].map((sira) => (
          <span
            key={sira}
            className="h-2.5 w-3 rounded-[2px] bg-zinc-100"
          />
        ))}
      </span>
      <span className="kil-cip px-2 py-0.5 text-xs font-semibold text-zinc-500">
        Değerlendirilmedi
      </span>
    </span>
  );
}
