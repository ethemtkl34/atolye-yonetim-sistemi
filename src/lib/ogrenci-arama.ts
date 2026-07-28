import { db } from "./db";
import { normalizeArama, normalizeTelefon } from "./turkce";

/**
 * §6.2 — Öğrenci arama.
 *
 * Koordinatör aynı kutuya hem isim hem telefon yazabilir; hangisi olduğu
 * girdiden anlaşılır. İsim araması `Student.searchName` sütunu üzerinden
 * yapılır: bu sütun kaydederken `normalizeArama()` ile üretilir, yani
 * "Şule Çınar" veritabanında "sule cinar" olarak da durur. Böylece arama
 * hem Türkçe karakter duyarsız hem de indeks kullanabilir hâle gelir —
 * sorgu anında sütunu dönüştürmek indeksi devre dışı bırakırdı.
 */

export type AramaSonucu = Awaited<ReturnType<typeof ogrenciAra>>[number];

export async function ogrenciAra(sorgu: string, enFazla = 50) {
  const temizSorgu = sorgu.trim();
  const isimAnahtari = normalizeArama(temizSorgu);
  const telefonAnahtari = normalizeTelefon(temizSorgu);

  // En az 3 rakam yoksa telefon araması yapılmaz; tek haneli bir rakam
  // yüzünden bütün velileri taramanın anlamı yok.
  const telefonAranabilir = telefonAnahtari.length >= 3;

  const kosullar = temizSorgu
    ? {
        OR: [
          { searchName: { contains: isimAnahtari } },
          ...(telefonAranabilir
            ? [
                {
                  guardians: {
                    some: { searchPhone: { contains: telefonAnahtari } },
                  },
                },
              ]
            : []),
        ],
      }
    : {};

  return db.student.findMany({
    where: kosullar,
    // §6.2 — Aynı isimli öğrencileri ayırt edebilmek için doğum tarihi,
    // okul ve sınıf sonuçlarda gösterilir.
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      school: true,
      grade: true,
      guardians: {
        select: { type: true, fullName: true, phone: true },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: enFazla,
  });
}
