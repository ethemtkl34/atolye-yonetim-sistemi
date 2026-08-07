"use client";

import { useActionState, useState, useTransition } from "react";
import { Buton } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * "Bölüm" bileşenlerinin ortak iskeleti.
 *
 * Terapi görüşmeleri, veli görüşmeleri ve zeka testleri bölümleri aynı deseni
 * paylaşır: başlık + adet, satır içi ekleme paneli, tıklanınca pencere açan
 * satır listesi, silme. Bu dosyadan önce iskelet üç dosyada satır satır
 * kopyalanmıştı (durum kancaları ve satır stiline kadar aynı).
 */

/** Bölüm başlığı: sol tarafta ad + adet, sağda ekleme düğmesi veya bağlantı. */
export function BolumUstu({
  baslik,
  adet,
  adetEtiketi,
  aksiyon,
}: {
  baslik: string;
  adet: number;
  /** "görüşme", "belge" — sayının birimi. Sıfırsa sayı hiç yazılmaz. */
  adetEtiketi: string;
  aksiyon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-zinc-900">
        {baslik}
        {adet > 0 ? (
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {adet} {adetEtiketi}
          </span>
        ) : null}
      </h2>
      {aksiyon}
    </div>
  );
}

/**
 * Liste satırı. Satırın kendisi düğme — telefonda kartın neresine dokunulursa
 * dokunulsun detay açılır. `onClick` verilmezse tıklanamaz düz kart çizilir
 * (zeka testlerinin LISTE yetki seviyesi) ve ok işareti hiç görünmez.
 */
export function DetaySatiri({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const govde = (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
      </span>
      {onClick ? (
        <span
          aria-hidden
          className="shrink-0 text-lg text-zinc-300 transition-colors group-hover:text-marka-600"
        >
          →
        </span>
      ) : null}
    </>
  );

  const temel =
    "flex w-full items-center justify-between gap-3 rounded-lg border border-yuzey-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(91,16,53,0.04)]";

  if (!onClick) {
    return <div className={temel}>{govde}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group ${temel} transition-colors hover:border-marka-200 hover:bg-marka-50`}
    >
      {govde}
    </button>
  );
}

/** Pencere alt şeridindeki "Ekleyen: … · tarih" + isteğe bağlı sil düğmesi. */
export function PencereAltBilgisi({
  bilgi,
  silmeDugmesi,
}: {
  bilgi: React.ReactNode;
  silmeDugmesi?: React.ReactNode;
}) {
  return (
    <>
      <span className="text-xs text-zinc-500">{bilgi}</span>
      {silmeDugmesi}
    </>
  );
}

/** Tehlike renkli sil düğmesi — çalışırken kendini kilitler. */
export function SilDugmesi({
  calisiyor,
  onClick,
  etiket = "Sil",
  calisiyorEtiketi = "Siliniyor…",
}: {
  calisiyor: boolean;
  onClick: () => void;
  etiket?: string;
  calisiyorEtiketi?: string;
}) {
  return (
    <Buton type="button" tur="tehlike" disabled={calisiyor} onClick={onClick}>
      {calisiyor ? calisiyorEtiketi : etiket}
    </Buton>
  );
}

/**
 * Satır içi ekleme panelinin durum kancası.
 *
 * Başarıdan sonra panel kapanır (render sırasında durum ayarlamadan — React
 * dokümanındaki "adjust state during render" deseni). `deger`, React 19'un
 * eylem sonrası form sıfırlamasına karşı alanları `durum.degerler`den geri
 * doldurur (bkz. lib/formlar.ts `formDegerleri`).
 */
export function useEklemePaneli<Durum extends EylemDurumu>(
  eylemFn: (onceki: Awaited<Durum>, formVerisi: FormData) => Promise<Durum>,
) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<Durum, FormData>(
    eylemFn,
    {} as Awaited<Durum>,
  );

  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  const deger = (alan: string) => durum.degerler?.[alan];

  return { acik, setAcik, durum, eylem, deger };
}

/**
 * Form dışı sunucu işlemleri (silme, not kaydetme): `useTransition` +
 * doğrudan çağrı. `useActionState` kullanılamıyor çünkü eylemin hedefi
 * (o an açık olan satır) önceden bağlanamıyor.
 */
export function useSunucuIslemi<Durum extends EylemDurumu>() {
  const [durum, setDurum] = useState<Durum>({} as Durum);
  const [calisiyor, basla] = useTransition();

  function calistir(
    is: () => Promise<Durum>,
    secenekler?: {
      /** `window.confirm` metni; verilirse onaylanmadan iş çalışmaz. */
      onay?: string;
      /** İş başarıyla bittiğinde (örn. pencereyi kapatmak için). */
      basarida?: () => void;
    },
  ) {
    if (secenekler?.onay && !window.confirm(secenekler.onay)) return;
    basla(async () => {
      const sonuc = await is();
      setDurum(sonuc);
      if (sonuc.basari) secenekler?.basarida?.();
    });
  }

  return { durum, calisiyor, calistir };
}
