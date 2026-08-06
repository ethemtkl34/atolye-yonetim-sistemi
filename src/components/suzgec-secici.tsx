"use client";

import { useRouter } from "next/navigation";
import { secimStili } from "@/components/ui";
import type { SuzgecSecenegi } from "@/components/suzgec";

/**
 * Süzgeç çubuğunun AÇILIR LİSTE varyantı — `SuzgecGrubu` ile aynı sözleşme
 * (`temelYol` / `anahtar` / `secili` / `digerler` → adres satırı), yalnızca
 * biçimi farklı: onlarca seçenekli süzgeçler (örn. öğrenci listesi) çip
 * grubuna sığmaz.
 *
 * Ayrı dosyada, çünkü seçim değişikliğini adrese yazmak `useRouter` ister ve
 * bu dosyayı istemciye çeker; `suzgec.tsx` ise sunucu bileşeni kalmalı.
 * Aile tek yerden görünsün diye `suzgec.tsx` bunu yeniden dışa aktarır.
 */
export function SuzgecSecici({
  etiket,
  temelYol,
  anahtar,
  secili,
  secenekler,
  digerler = {},
}: {
  etiket: string;
  /** Süzgecin bağlandığı sayfa, örn. "/koordinator/danismanlik". */
  temelYol: string;
  /** Bu süzgecin adres parametresi, örn. "ogrenci". */
  anahtar: string;
  /** Seçili değer; boş dize = süzgeç kapalı ("Tümü"). */
  secili: string;
  secenekler: readonly SuzgecSecenegi[];
  /** Adreste korunacak diğer süzgeçler. */
  digerler?: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-zinc-500">{etiket}:</span>
      <select
        value={secili}
        onChange={(olay) => {
          const parametreler = new URLSearchParams(digerler);
          parametreler.delete(anahtar);
          if (olay.target.value) {
            parametreler.set(anahtar, olay.target.value);
          }
          router.push(`${temelYol}?${parametreler.toString()}`);
        }}
        className={`${secimStili} w-auto`}
      >
        <option value="">Tümü</option>
        {secenekler.map((secenek) => (
          <option key={secenek.deger} value={secenek.deger}>
            {secenek.etiket}
          </option>
        ))}
      </select>
    </label>
  );
}
