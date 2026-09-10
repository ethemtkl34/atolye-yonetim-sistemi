import { db } from "@/lib/db";
import { gunEkle, tarihBicimle } from "@/lib/tarih";
import {
  gunlereBol,
  takvimAraligi,
  type TakvimAraligi,
} from "@/lib/randevu/takvim-verisi";
import {
  haftaEkseni,
  haftaSutunlariniOlustur,
} from "@/lib/randevu/izgara-verisi";
import type { RandevuSatiri } from "@/app/koordinator/randevular/takvim";

/**
 * Hem `randevular/page.tsx` (dört görünüm) hem aday akışının randevu
 * seçicisi bu sorguyu kullanır — branch'e göre PII gizleme (§17.7) TEK
 * yerde yaşasın diye.
 */
export async function randevuSatirlariGetir(args: {
  subeId: string;
  aralik: TakvimAraligi;
  uzmanSuzgeci?: string;
  hizmetSuzgeci?: string;
  iptalleriGoster?: boolean;
}): Promise<RandevuSatiri[]> {
  const randevular = await db.randevu.findMany({
    where: {
      baslangic: { gte: args.aralik.ilk, lt: args.aralik.son },
      ...(args.iptalleriGoster ? { durum: "IPTAL" } : { durum: { not: "IPTAL" } }),
      ...(args.uzmanSuzgeci && args.uzmanSuzgeci !== "tumu"
        ? { uzmanId: args.uzmanSuzgeci }
        : {}),
      ...(args.hizmetSuzgeci && args.hizmetSuzgeci !== "tumu"
        ? { hizmetId: args.hizmetSuzgeci }
        : {}),
    },
    orderBy: { baslangic: "asc" },
    select: {
      id: true,
      branchId: true,
      baslangic: true,
      bitis: true,
      durum: true,
      ucretKurus: true,
      indirimKurus: true,
      seriId: true,
      not: true,
      iptalNotu: true,
      uzman: { select: { id: true, ad: true, renk: true } },
      hizmet: { select: { ad: true } },
      veli: { select: { fullName: true, phone: true } },
      ogrenci: { select: { firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
  });

  return randevular.map((randevu) => {
    const bizim = randevu.branchId === args.subeId;
    return {
      id: randevu.id,
      bizim,
      subeAdi: randevu.branch.name,
      baslangic: randevu.baslangic,
      bitis: randevu.bitis,
      durum: randevu.durum,
      uzmanId: randevu.uzman.id,
      uzmanAdi: randevu.uzman.ad,
      uzmanRengi: randevu.uzman.renk,
      hizmetAdi: randevu.hizmet.ad,
      seriDeMi: Boolean(randevu.seriId),
      veliAdi: bizim ? randevu.veli.fullName : null,
      veliTelefon: bizim ? randevu.veli.phone : null,
      ogrenciAdi:
        bizim && randevu.ogrenci
          ? `${randevu.ogrenci.firstName} ${randevu.ogrenci.lastName}`
          : null,
      not: bizim ? randevu.not : null,
      iptalNotu: bizim ? randevu.iptalNotu : null,
      ucretKurus: bizim ? randevu.ucretKurus - randevu.indirimKurus : null,
    };
  });
}

export async function haftaRandevuVerisi(args: {
  subeId: string;
  capa: Date;
  uzmanSuzgeci?: string;
  hizmetSuzgeci?: string;
  iptalleriGoster?: boolean;
}) {
  // Hafta başlangıcı `takvimAraligi`'den okunuyor — bu hesap `page.tsx`'teki
  // hafta görünümüyle AYNI yerden gelmezse iki ekran farklı haftalar
  // gösterebilirdi (bkz. takvim-verisi.ts şerhi).
  const aralik = takvimAraligi("hafta", args.capa);
  const satirlar = await randevuSatirlariGetir({ ...args, aralik });
  const sutunlar = haftaSutunlariniOlustur(gunlereBol(aralik, satirlar));
  return {
    baslik: `${tarihBicimle(aralik.ilk)} – ${tarihBicimle(gunEkle(aralik.son, -1))}`,
    sutunlar,
    eksen: haftaEkseni(sutunlar),
    toplam: satirlar.length,
  };
}

/**
 * `haftaRandevuVerisi`'nin dönüş tipi — istemci bileşenleri bunu KAYNAK
 * modülden alır. `"use server"` eylem dosyasından (`randevular/actions.ts`)
 * `typeof import(...)` ile tip türetmek derlemede sorunsuz görünüp canlıda
 * "use server" paketleme adımını bozabiliyor; tip her zaman düz bir lib
 * dosyasından gelmeli.
 */
export type HaftaRandevuVerisi = Awaited<ReturnType<typeof haftaRandevuVerisi>>;
