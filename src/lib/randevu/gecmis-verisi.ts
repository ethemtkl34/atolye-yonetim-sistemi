import { db } from "@/lib/db";
import type { RandevuDurumu } from "@/lib/randevu/gecmis-ozeti";

/**
 * Kişi bazlı randevu geçmişi sorguları (Eylül 2026) — öğrenci kartı, uzman
 * sayfası ve Randevular'daki "Öğrenci geçmişi" penceresi aynı yerden okur.
 */

export type GecmisRandevuSatiri = {
  id: string;
  baslangic: Date;
  bitis: Date;
  durum: RandevuDurumu;
  /** Oturumdaki şubenin randevusu mu — değilse danışan, ücret ve notlar gizli. */
  bizim: boolean;
  subeAdi: string;
  uzmanAdi: string;
  uzmanRengi: string;
  hizmetAdi: string;
  /** "Çocuk (Veli)" ya da yalnız veli; başka şubede null. */
  danisanAdi: string | null;
  /** İndirim düşülmüş tutar; başka şubede null. */
  netUcretKurus: number | null;
  not: string | null;
  iptalNotu: string | null;
};

const SECIM = {
  id: true,
  branchId: true,
  baslangic: true,
  bitis: true,
  durum: true,
  ucretKurus: true,
  indirimKurus: true,
  not: true,
  iptalNotu: true,
  branch: { select: { name: true } },
  uzman: { select: { ad: true, renk: true } },
  hizmet: { select: { ad: true } },
  veli: { select: { fullName: true } },
  ogrenci: { select: { firstName: true, lastName: true } },
} as const;

type HamSatir = {
  id: string;
  branchId: string;
  baslangic: Date;
  bitis: Date;
  durum: RandevuDurumu;
  ucretKurus: number;
  indirimKurus: number;
  not: string | null;
  iptalNotu: string | null;
  branch: { name: string };
  uzman: { ad: string; renk: string };
  hizmet: { ad: string };
  veli: { fullName: string };
  ogrenci: { firstName: string; lastName: string } | null;
};

/** §17.7: başka şubenin randevusunda yalnız "o saat doluydu" bilgisi kalır. */
function satiraCevir(ham: HamSatir, subeId: string): GecmisRandevuSatiri {
  const bizim = ham.branchId === subeId;
  const cocuk = ham.ogrenci ? `${ham.ogrenci.firstName} ${ham.ogrenci.lastName}` : null;
  return {
    id: ham.id,
    baslangic: ham.baslangic,
    bitis: ham.bitis,
    durum: ham.durum,
    bizim,
    subeAdi: ham.branch.name,
    uzmanAdi: ham.uzman.ad,
    uzmanRengi: ham.uzman.renk,
    hizmetAdi: ham.hizmet.ad,
    danisanAdi: bizim ? (cocuk ? `${cocuk} (${ham.veli.fullName})` : ham.veli.fullName) : null,
    netUcretKurus: bizim ? ham.ucretKurus - ham.indirimKurus : null,
    not: bizim ? ham.not : null,
    iptalNotu: bizim ? ham.iptalNotu : null,
  };
}

/**
 * Öğrencinin BÜTÜN randevuları — geçmiş ve gelecek, iptaller dahil, en
 * yeniden eskiye. ÇAĞIRAN öğrenciyi şubesiyle doğrulamış olmalı
 * (`student.findFirst({ id, branchId })`).
 */
export async function ogrenciRandevulari(
  ogrenciId: string,
  subeId: string,
): Promise<GecmisRandevuSatiri[]> {
  // şube-muaf: öğrenci çağıran tarafta şubesiyle doğrulanıyor ve randevu
  // öğrencinin şubesinde açılıyor; başka şubede açılmış bir satır olsa bile
  // `satiraCevir` danışan ve ücreti gizliyor.
  const randevular = await db.randevu.findMany({
    where: { ogrenciId },
    orderBy: { baslangic: "desc" },
    select: SECIM,
  });
  return randevular.map((ham) => satiraCevir(ham, subeId));
}

/**
 * Uzmanın bir tarih aralığındaki randevuları, en yeniden eskiye.
 *
 * Uzman iki şubede çalışabildiği için BÜTÜN şubelerin randevusu gelir
 * (takvimle aynı ilke, §17.7); danışan, ücret ve notlar yalnız `subeId`
 * şubesinde açık.
 */
export async function uzmanRandevulari(args: {
  uzmanId: string;
  subeId: string;
  ilk: Date;
  son: Date;
}): Promise<GecmisRandevuSatiri[]> {
  // şube-muaf: uzman kadrosu şubeler arası (§17.7); kişisel veri
  // `satiraCevir` içinde şubeye göre ayıklanıyor.
  const randevular = await db.randevu.findMany({
    where: { uzmanId: args.uzmanId, baslangic: { gte: args.ilk, lt: args.son } },
    orderBy: { baslangic: "desc" },
    select: SECIM,
  });
  return randevular.map((ham) => satiraCevir(ham, args.subeId));
}
