"use server";

import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";

/**
 * §17.4 — Randevu formundaki veli araması.
 *
 * `"use server"` bir eylem dosyası: yalnızca async fonksiyon dışa aktarır —
 * TİP BİLE aktaramaz, oradan `export type` yapmak üretimde 500 veriyor ve
 * tsc/test/derleme üçü de yakalamıyor (bkz. ogrenciler/sema.ts şerhi). Sonuç
 * tipi bu yüzden `veli-secici.tsx` içinde `Awaited<ReturnType<…>>` ile
 * türetiliyor.
 *
 * ARAMA: ad VEYA telefon, `Veli` kaydının normalize sütunlarından —
 * öğrenci aramasıyla aynı sözleşme (§6.2). Şube süzgeci zorunlu.
 */

export async function veliAra(sorgu: string) {
  const kullanici = await yonetimZorunlu("randevular");

  const temiz = sorgu.trim();
  if (temiz.length < 2) return [];

  const isimAnahtari = normalizeArama(temiz);
  const telefonAnahtari = normalizeTelefon(temiz);
  const telefonAranabilir = telefonAnahtari.length >= 3;

  const veliler = await db.veli.findMany({
    where: {
      branchId: kullanici.aktifSubeId,
      OR: [
        { searchName: { contains: isimAnahtari } },
        ...(telefonAranabilir
          ? [{ searchPhone: { contains: telefonAnahtari } }]
          : []),
      ],
    },
    orderBy: { fullName: "asc" },
    take: 12,
    select: {
      id: true,
      fullName: true,
      phone: true,
      guardians: {
        select: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { randevular: true } },
    },
  });

  return veliler.map((veli) => ({
    id: veli.id,
    ad: veli.fullName,
    telefon: veli.phone,
    cocuklar: veli.guardians.map((bag) => ({
      id: bag.student.id,
      ad: `${bag.student.firstName} ${bag.student.lastName}`,
    })),
    randevuSayisi: veli._count.randevular,
  }));
}
