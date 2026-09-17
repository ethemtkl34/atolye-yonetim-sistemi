import { db } from "@/lib/db";
import { gunEkle, tarihBicimle, tarihMetni } from "@/lib/tarih";
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
import { randevuGecmisMi } from "@/lib/randevu/gecmis-kilidi";

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
  /** Oturumdaki kullanıcı geçmiş randevuyu değiştirebilir mi (yöneticiler). */
  gecmisiDuzenleyebilir?: boolean;
  /**
   * Takvimin "Şube" süzgeci (Eylül 2026): yalnız bu şubenin randevuları.
   * Verilmezse şubeler arası okunur. Hangi satırın "bizim" sayılacağı
   * (danışan görünür, düzenlenir) süzgeçten bağımsız olarak `subeId`den
   * gelir — süzgeç yalnız neyin GÖSTERİLECEĞİNİ seçer.
   */
  gosterilenSube?: string;
}): Promise<RandevuSatiri[]> {
  const simdi = new Date();
  const randevular = await db.randevu.findMany({
    where: {
      ...(args.gosterilenSube ? { branchId: args.gosterilenSube } : {}),
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
      indirimNotu: true,
      seriId: true,
      not: true,
      iptalNotu: true,
      uzman: { select: { id: true, ad: true, renk: true } },
      hizmet: { select: { id: true, ad: true } },
      veli: { select: { id: true, fullName: true, phone: true } },
      ogrenci: { select: { id: true, firstName: true, lastName: true, birthDate: true } },
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
      hizmetId: randevu.hizmet.id,
      hizmetAdi: randevu.hizmet.ad,
      seriDeMi: Boolean(randevu.seriId),
      veliId: bizim ? randevu.veli.id : null,
      veliAdi: bizim ? randevu.veli.fullName : null,
      veliTelefon: bizim ? randevu.veli.phone : null,
      ogrenciId: bizim && randevu.ogrenci ? randevu.ogrenci.id : null,
      ogrenciAdi:
        bizim && randevu.ogrenci
          ? `${randevu.ogrenci.firstName} ${randevu.ogrenci.lastName}`
          : null,
      ogrenciAd: bizim && randevu.ogrenci ? randevu.ogrenci.firstName : null,
      ogrenciSoyad: bizim && randevu.ogrenci ? randevu.ogrenci.lastName : null,
      ogrenciDogumTarihi:
        bizim && randevu.ogrenci?.birthDate ? tarihMetni(randevu.ogrenci.birthDate) : null,
      not: bizim ? randevu.not : null,
      iptalNotu: bizim ? randevu.iptalNotu : null,
      ucretKurus: bizim ? randevu.ucretKurus - randevu.indirimKurus : null,
      // Düzenleme formunun "İndirim (₺)" alanını doldurmak için — yukarıdaki
      // `ucretKurus` zaten indirim düşülmüş NET tutar, forma geri
      // yazılamaz; ham indirim burada ayrıca taşınıyor.
      indirimKurus: bizim ? randevu.indirimKurus : null,
      indirimNotu: bizim ? randevu.indirimNotu : null,
      kilitli: !args.gecmisiDuzenleyebilir && randevuGecmisMi(randevu.baslangic, simdi),
      // Silme yalnız bugünkü ve gelecek randevuda — yöneticide de (ciroya
      // girmiş geçmiş seans silinmez, iptal edilir).
      silinebilir: !randevuGecmisMi(randevu.baslangic, simdi),
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
