"use client";

import { useSyncExternalStore } from "react";

/**
 * Ekran telefon genişliğinde mi (Tailwind `sm` kırılımının altı)?
 *
 * Bazı mobil davranışlar CSS ile çözülemiyor: aynı veriyi iki biçimde
 * çizmek DOM'u ikiye katlıyor (etkileşimli öğelerde iki ayrı durum demek) ya
 * da hafta ızgarasında olduğu gibi hangi günün gösterileceği bir DURUM.
 * Bu kanca o kararları tek yerden veriyor.
 *
 * `useSyncExternalStore`: sunucuda `false` (masaüstü düzeni) döner, istemci
 * bağlanınca gerçek değere geçer — efekt içinde `setState` yok, yani
 * `react-hooks/set-state-in-effect` kuralına takılmıyor ve hidrasyon
 * uyuşmazlığı üretmiyor.
 */
export function useDarEkran(kirilimPx = 640): boolean {
  return useSyncExternalStore(
    (dinleyici) => {
      const sorgu = window.matchMedia(`(max-width: ${kirilimPx - 1}px)`);
      sorgu.addEventListener("change", dinleyici);
      return () => sorgu.removeEventListener("change", dinleyici);
    },
    () => window.matchMedia(`(max-width: ${kirilimPx - 1}px)`).matches,
    () => false,
  );
}
