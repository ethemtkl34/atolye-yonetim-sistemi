"use client";

import { HaftaIzgarasiGovdesi } from "@/app/koordinator/randevular/hafta-izgarasi-govde";
import type { ProgramVerisi } from "@/lib/randevu/program-verisi";

/**
 * §17.8 — Program sayfasının ızgarasını saran ince istemci katmanı.
 *
 * VAR OLMA SEBEBİ: `HaftaIzgarasiGovdesi` bir istemci bileşeni ve
 * `blokAltYazisi` bir FONKSİYON. Sunucu bileşeni istemci bileşenine fonksiyon
 * geçemiyor ("Functions cannot be passed directly to Client Components") —
 * panelin çağıranları zaten istemci olduğu için orada sorun çıkmıyor, bu
 * sayfa sunucu bileşeni olduğu için çıkıyordu. Fonksiyonun istemci sınırının
 * İÇİNDE doğması yetiyor.
 *
 * Alt yazı danışan adı: bu ızgarada tek uzman var, her blokta kendi adını
 * okumak gürültü olurdu (panelde tersi — orada uzmanı ayırt etmek gerekiyor).
 */
export function ProgramIzgarasi({
  sutunlar,
  eksen,
}: {
  sutunlar: ProgramVerisi["sutunlar"];
  eksen: ProgramVerisi["eksen"];
}) {
  return (
    <HaftaIzgarasiGovdesi
      sutunlar={sutunlar}
      eksen={eksen}
      blokAltYazisi={(randevu) => randevu.danisanAdi}
    />
  );
}
