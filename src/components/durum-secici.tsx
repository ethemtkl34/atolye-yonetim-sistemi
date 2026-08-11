"use client";

import { useState, useTransition } from "react";

/**
 * Program durum seçicisi — dönem ve kulüp sayfalarının ortak bileşeni.
 *
 * Önceden iki kopyaydı (`donemler/[id]` ve `kulupler/[id]` altında); tek
 * fark durum sözlüğü ve çağrılan eylemdi, ikisi de artık prop.
 *
 * Hata gösterimi şart: kutu `value={mevcutDurum}` ile sunucudan besleniyor,
 * yani eylem başarısız olursa seçim eski değerine geri döner ve kullanıcı
 * hiçbir açıklama görmez — "seçtim ama olmadı" denen durum tam olarak bu.
 */
export function DurumSecici<Durum extends string>({
  mevcutDurum,
  durumlar,
  gecisler,
  eylem,
}: {
  mevcutDurum: Durum;
  /** Durum kodu → görünen etiket (örn. `DONEM_DURUMLARI`). */
  durumlar: Record<Durum, { etiket: string }>;
  /** Durum kodu → geçilebilen durumlar (örn. `DONEM_DURUM_GECISLERI`). */
  gecisler: Record<Durum, Durum[]>;
  /** Kimliği bağlanmış server action: `donemDurumDegistir.bind(null, id)`. */
  eylem: (yeniDurum: Durum) => Promise<{ hata?: string } | void>;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        Durum
        <select
          value={mevcutDurum}
          disabled={bekliyor}
          onChange={(e) => {
            const yeni = e.target.value as Durum;
            setHata(null);
            basla(async () => {
              const sonuc = await eylem(yeni);
              if (sonuc?.hata) setHata(sonuc.hata);
            });
          }}
          className="kil-girdi min-h-[2.75rem] text-base outline-none disabled:opacity-60 sm:min-h-[2.25rem] sm:text-sm"
        >
          {/* Yalnızca mevcut durum ve ondan geçilebilen durumlar listelenir;
              sunucu da aynı kuralı uygular, burada saklamak kullanıcıyı
              baştan yanlış seçimden korur. */}
          {(Object.keys(durumlar) as Durum[])
            .filter(
              (kod) =>
                kod === mevcutDurum || gecisler[mevcutDurum].includes(kod),
            )
            .map((kod) => (
              <option key={kod} value={kod}>
                {durumlar[kod].etiket}
              </option>
            ))}
        </select>
      </label>
      {hata ? (
        <p role="alert" className="text-xs text-red-700">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
