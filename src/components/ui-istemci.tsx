"use client";

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
