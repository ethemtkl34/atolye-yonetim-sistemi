"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Buton } from "@/components/ui";

/**
 * `ui.tsx`'in istemci tarafı parçaları.
 *
 * Ayrı dosya olmasının sebebi teknik: `useFormStatus` bir istemci hook'u ve
 * bu dosyaya `"use client"` yazmayı zorunlu kılıyor. `ui.tsx`'e yazılsaydı
 * oradaki stil sabitleri (`butonStili`, `secimStili`...) sunucu
 * bileşenlerinden kullanılamaz hâle gelirdi.
 */

/**
 * Form gönder butonu — eylem çalışırken kendini kilitleyip bekleyen etiketi
 * gösterir. Bu bileşenden önce aynı `useFormStatus` sarmalayıcısı 20'den
 * fazla dosyada birebir kopyalanmıştı.
 *
 * `<form action={...}>` İÇİNDE durmalı; `useFormStatus` durumu en yakın
 * üst formdan okur.
 */
export function GonderButonu({
  bekleyenEtiket = "Kaydediliyor…",
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Buton> & {
  /** Eylem çalışırken gösterilecek metin ("Yükleniyor…", "Ekleniyor…"). */
  bekleyenEtiket?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Buton type="submit" disabled={pending || disabled} {...props}>
      {pending ? bekleyenEtiket : children}
    </Buton>
  );
}

/**
 * Native `<dialog>` penceresi — odak tuzağı, ESC ile kapanma ve arka plan
 * engeli tarayıcıdan gelir. Bu bileşenden önce aynı ref + effect + kapatma
 * düğmesi iskeleti dört ayrı dosyada kopyalanmıştı.
 *
 * Kapalıyken içerik hiç render edilmez: form durumu ve seçimler her açılışta
 * sıfırdan başlar, pencere içindeki belge önizlemeleri boşuna yüklenmez.
 */
export function Pencere({
  acik,
  onKapat,
  baslik,
  altBaslik,
  altKisim,
  genislik = "36rem",
  govdeSinifi = "space-y-4 overflow-y-auto p-4",
  children,
}: {
  acik: boolean;
  onKapat: () => void;
  /** Başlık satırı — başlık metni + rozetler yan yana dizilir. */
  baslik: React.ReactNode;
  /** Başlığın altındaki küçük açıklama satırı. */
  altBaslik?: React.ReactNode;
  /** Alt şerit (footer); verilmezse çizilmez. */
  altKisim?: React.ReactNode;
  /** Pencere genişliği; dar ekranda kendiliğinden daralır. */
  genislik?: string;
  /** Gövdenin sınıfları — kaydırma ve iç boşluk burada. */
  govdeSinifi?: string;
  children: React.ReactNode;
}) {
  const pencereRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const pencere = pencereRef.current;
    if (!pencere) return;
    if (acik && !pencere.open) pencere.showModal();
    if (!acik && pencere.open) pencere.close();
  }, [acik]);

  return (
    <dialog
      ref={pencereRef}
      onClose={onKapat}
      style={{ width: `min(${genislik}, calc(100vw - 2rem))` }}
      className="m-auto rounded-lg bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-marka-950/50"
    >
      {acik ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-yuzey-100 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">{baslik}</div>
              {altBaslik ? (
                <p className="mt-0.5 text-sm text-zinc-600">{altBaslik}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onKapat}
              aria-label="Pencereyi kapat"
              className="flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-md text-lg text-zinc-400 hover:bg-marka-50 hover:text-zinc-700 sm:min-h-0 sm:min-w-0 sm:px-2"
            >
              ×
            </button>
          </header>

          <div className={govdeSinifi}>{children}</div>

          {altKisim ? (
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-yuzey-100 p-4">
              {altKisim}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
