"use server";

import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { normalizeArama } from "@/lib/turkce";

/**
 * §17.4 — Randevular'daki "öğrenci geçmişi" araması.
 *
 * `veli-arama.ts`nin öğrenci karşılığı: kayıt oluştururken danışanı bulmak
 * için değil, GEÇMİŞE bakmak için — "bu çocuk hangi haftalarda, hangi
 * hizmete geldi" sorusuna cevap. Şube süzgeci zorunlu (§17.7): danışan
 * bilgisi yalnız kendi şubede.
 */

export async function ogrenciAra(sorgu: string) {
  const kullanici = await yonetimZorunlu("randevular");

  const temiz = sorgu.trim();
  if (temiz.length < 2) return [];

  const isimAnahtari = normalizeArama(temiz);

  const ogrenciler = await db.student.findMany({
    where: { branchId: kullanici.aktifSubeId, searchName: { contains: isimAnahtari } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 12,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: {
        select: { veli: { select: { fullName: true } } },
      },
      _count: { select: { randevular: true } },
    },
  });

  return ogrenciler.map((ogrenci) => ({
    id: ogrenci.id,
    ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
    veliAdi: ogrenci.guardians.map((bag) => bag.veli.fullName).join(", ") || null,
    randevuSayisi: ogrenci._count.randevular,
  }));
}

/** Öğrencinin TÜM randevuları — en yeniden eskiye, iptaller dahil. */
export async function ogrenciRandevuGecmisi(ogrenciId: string) {
  const kullanici = await yonetimZorunlu("randevular");

  // şube-muaf değil: öğrenci başka şubeden geldiyse hiçbir satır dönmez —
  // takvimin aksine geçmiş aramasında "başka şubenin randevusu" gösterecek
  // bir görünüm yok, en güvenlisi hiç göstermemek.
  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId, branchId: kullanici.aktifSubeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!ogrenci) return null;

  const randevular = await db.randevu.findMany({
    where: { ogrenciId },
    orderBy: { baslangic: "desc" },
    select: {
      id: true,
      baslangic: true,
      bitis: true,
      durum: true,
      not: true,
      iptalNotu: true,
      uzman: { select: { ad: true, renk: true } },
      hizmet: { select: { ad: true } },
    },
  });

  return {
    ogrenci: { id: ogrenci.id, ad: `${ogrenci.firstName} ${ogrenci.lastName}` },
    randevular: randevular.map((randevu) => ({
      id: randevu.id,
      baslangic: randevu.baslangic,
      bitis: randevu.bitis,
      durum: randevu.durum,
      not: randevu.not,
      iptalNotu: randevu.iptalNotu,
      uzmanAdi: randevu.uzman.ad,
      uzmanRengi: randevu.uzman.renk,
      hizmetAdi: randevu.hizmet.ad,
    })),
  };
}
