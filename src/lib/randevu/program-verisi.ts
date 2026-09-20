import { db } from "@/lib/db";
import { gunEkle, tarihBicimle } from "@/lib/tarih";
import { takvimAraligi, gunlereBol } from "@/lib/randevu/takvim-verisi";
import {
  haftaEkseni,
  haftaSutunlariniOlustur,
  type HaftaSutunu,
  type IzgaraEkseni,
} from "@/lib/randevu/izgara-verisi";

/**
 * §17.8 — Uzmanın giriş gerektirmeyen haftalık program sayfasının verisi.
 *
 * Panelin `haftaRandevuVerisi`'si BİLEREK kullanılmıyor. O fonksiyon ücreti,
 * indirimi, veli telefonunu, randevu ve iptal notunu taşıyor; hepsi bu
 * sayfaya gitse tarayıcının HTML'ine düşerdi ve adres tek savunma olduğu
 * için kurum dışına sızardı. Buradaki `select` o yüzden dar: sorgu ne
 * okumazsa sayfa onu sızdıramaz.
 *
 * ŞUBE: uzman çok şubeli çalışabiliyor ve bu onun KENDİ programı — Ümraniye
 * ile Güneşli seansları tek takvimde, şube adı blokta yazılı. Panelin
 * şube-kapsamlı okumasından ayrıldığı tek nokta bu, kasıtlı.
 */

/** Program sayfasının bir randevu satırı — ızgaranın okuduğu alanlar + danışan. */
export type ProgramRandevusu = {
  id: string;
  baslangic: Date;
  bitis: Date;
  durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI" | "IPTAL";
  uzmanRengi: string;
  hizmetAdi: string;
  /** Seansa gelen kişi: çocuk varsa o, yoksa veli (aile danışmanlığı). */
  danisanAdi: string;
  subeAdi: string;
};

export type ProgramVerisi = {
  uzman: { id: string; ad: string; renk: string };
  baslik: string;
  sutunlar: HaftaSutunu<ProgramRandevusu>[];
  eksen: IzgaraEkseni;
  toplam: number;
};

/**
 * Jetonun sahibi uzmanı bulur. Pasif uzman BULUNMAZ: kadrodan çıkarılan
 * kişinin elindeki adres kendiliğinden ölmeli, ayrıca jeton silmek
 * gerekmesin.
 */
export async function programJetonununUzmani(jeton: string) {
  return db.uzman.findFirst({
    where: { programJetonu: jeton, aktif: true },
    select: { id: true, ad: true, renk: true },
  });
}

/** Uzmanın bir haftalık programı — tüm şubeler, iptaller hariç. */
export async function programVerisi(args: {
  uzmanId: string;
  uzmanAdi: string;
  uzmanRengi: string;
  capa: Date;
}): Promise<ProgramVerisi> {
  const aralik = takvimAraligi("hafta", args.capa);

  // şube-muaf: uzmanın kendi programı şubeler arası (yukarıdaki şerh).
  const randevular = await db.randevu.findMany({
    where: {
      uzmanId: args.uzmanId,
      baslangic: { gte: aralik.ilk, lt: aralik.son },
      durum: { not: "IPTAL" },
    },
    orderBy: { baslangic: "asc" },
    select: {
      id: true,
      baslangic: true,
      bitis: true,
      durum: true,
      hizmet: { select: { ad: true } },
      veli: { select: { fullName: true } },
      ogrenci: { select: { firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
  });

  const satirlar: ProgramRandevusu[] = randevular.map((randevu) => ({
    id: randevu.id,
    baslangic: randevu.baslangic,
    bitis: randevu.bitis,
    durum: randevu.durum,
    // Renk uzmanın kendi rengi: ızgara tek uzmanlık ama bloklar panelle aynı
    // görünsün diye aynı paletten geliyor.
    uzmanRengi: args.uzmanRengi,
    hizmetAdi: randevu.hizmet.ad,
    danisanAdi: randevu.ogrenci
      ? `${randevu.ogrenci.firstName} ${randevu.ogrenci.lastName}`
      : randevu.veli.fullName,
    subeAdi: randevu.branch.name,
  }));

  const sutunlar = haftaSutunlariniOlustur(gunlereBol(aralik, satirlar));

  return {
    uzman: { id: args.uzmanId, ad: args.uzmanAdi, renk: args.uzmanRengi },
    baslik: `${tarihBicimle(aralik.ilk)} – ${tarihBicimle(gunEkle(aralik.son, -1))}`,
    sutunlar,
    eksen: haftaEkseni(sutunlar),
    toplam: satirlar.length,
  };
}
