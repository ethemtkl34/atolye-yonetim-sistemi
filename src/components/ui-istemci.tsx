"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Buton, DonenHalka } from "@/components/ui";
import { cn } from "@/lib/utils";

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
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <DonenHalka />
          {bekleyenEtiket}
        </span>
      ) : (
        children
      )}
    </Buton>
  );
}

/**
 * Sekme şeridi — uzun bir formu bölümlere ayırır.
 *
 * Kil dili: seçili sekme GÖMÜK durur (basılı olan içeri gider), seçilmeyen
 * kabarık kalır. Dokunma hedefi telefondaki 44px kuralına uyar.
 *
 * ⚠️ Bu bileşen yalnızca ŞERİDİ çizer, içeriği DEĞİL. Sebebi kritik: form
 * içinde kullanıldığında pasif sekmenin içeriği DOM'dan kaldırılmamalı —
 * kaldırılırsa o sekmedeki alanlar gönderime hiç girmez ve kullanıcı farkında
 * olmadan yarım kayıt üretir. Çağıran taraf bölümleri `hidden` ile gizler
 * (bkz. `SekmePaneli`).
 */
export function Sekmeler({
  sekmeler,
  etkin,
  onSecim,
  etiket,
}: {
  sekmeler: readonly { deger: string; etiket: string; rozet?: number }[];
  etkin: string;
  onSecim: (deger: string) => void;
  /** Şeridin erişilebilirlik adı ("Görüşme formu bölümleri"). */
  etiket: string;
}) {
  return (
    <div role="tablist" aria-label={etiket} className="flex flex-wrap gap-2">
      {sekmeler.map((sekme) => {
        const secili = sekme.deger === etkin;
        return (
          <button
            key={sekme.deger}
            type="button"
            role="tab"
            aria-selected={secili}
            aria-controls={`sekme-panel-${sekme.deger}`}
            onClick={() => onSecim(sekme.deger)}
            className={cn(
              "kil-satir flex min-h-[2.75rem] items-center gap-2 px-3.5 text-sm sm:min-h-[2.25rem]",
              secili
                ? "bg-[#efe5eb] font-semibold text-marka-700 shadow-[var(--kil-ic)]"
                : "text-zinc-700",
            )}
          >
            {sekme.etiket}
            {sekme.rozet ? (
              <span className="kil-rozet rounded-full px-1.5 text-xs font-semibold text-marka-700">
                {sekme.rozet}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Bir sekmenin gövdesi. Pasif olduğunda `hidden` ile gizlenir ama DOM'da
 * KALIR — içindeki form alanları gönderime girmeye devam eder.
 */
export function SekmePaneli({
  deger,
  etkin,
  children,
}: {
  deger: string;
  etkin: string;
  children: React.ReactNode;
}) {
  const gizli = deger !== etkin;
  return (
    <div
      id={`sekme-panel-${deger}`}
      role="tabpanel"
      hidden={gizli}
      // `hidden` özniteliği Tailwind'in `display` yardımcılarıyla ezilebiliyor;
      // gizli panelin sekme sırasından da çıkması için inert veriliyor.
      inert={gizli}
      className="space-y-4"
    >
      {children}
    </div>
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
      // Arka plan bulanıklığı `backdrop:` katmanında (kil temasında
      // `.kil-pencere::backdrop`): pencerenin ardındaki liste okunur kalmayıp
      // geri çekiliyor, odak pencerede kalıyor.
      className="kil-pencere m-auto text-zinc-900"
    >
      {acik ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight">
                {baslik}
              </div>
              {altBaslik ? (
                <p className="mt-0.5 text-sm text-zinc-600">{altBaslik}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onKapat}
              aria-label="Pencereyi kapat"
              className="kil-rozet flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-zinc-600 hover:text-zinc-900"
            >
              ✕
            </button>
          </header>

          <div className={govdeSinifi}>{children}</div>

          {altKisim ? (
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/70 px-5 py-4 shadow-[inset_0_1px_0_var(--kil-golge)]">
              {altKisim}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
