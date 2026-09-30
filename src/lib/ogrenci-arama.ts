import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { aktifOgrenciKosulu } from "./durumlar";
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

export type AramaSonucu =
  Awaited<ReturnType<typeof ogrenciAra>>["ogrenciler"][number];

export type AramaSecenekleri = {
  /**
   * Çalışılan şube. Öğrenciler iki şubede ORTAK havuzda (Eylül 2026) —
   * arama öğrenciyi şubeyle SÜZMEZ. Bu değer yalnız GRUP tarafında
   * kullanılıyor: "aktif" kapsam ve program süzgeci bu şubenin gruplarına
   * bakar, çünkü dönem, kulüp ve grup şubeye aittir.
   */
  subeId: string;
  /**
   * İsteğe bağlı kayıt şubesi süzgeci: öğrencinin ETİKETİ (`Student.branchId`).
   * Boşsa iki şubenin öğrencileri birlikte döner.
   */
  kayitSubesiId?: string;
  enFazla?: number;
  /** Sayfalama için atlanacak kayıt sayısı. */
  atla?: number;
  /**
   * "aktif" seçilirse yalnızca aktif bir programda aktif kaydı olan öğrenciler
   * döner — dashboardun "Aktif öğrenci" kartının karşılığı (§12.1).
   */
  kapsam?: "tumu" | "aktif";
  /**
   * Program süzgeci (Eylül 2026): yalnız bu dönemde ya da kulüpte AKTİF
   * kaydı olan öğrenciler. İptal edilmiş kayıt "kayıtlı" saymaz — listeden
   * çıkarılmış öğrenci programın listesinde görünmemeli. İkisi birden
   * verilmez; süzgeç tek bir program seçtiriyor.
   */
  donemId?: string;
  kulupId?: string;
};

/**
 * Aramanın `where` koşulu — sorgudan ve süzgeçlerden türetilen SAF parça.
 * Ayrı fonksiyon olunca koşul testten okunabiliyor (`ogrenci-arama.test.ts`).
 *
 * ORTAK HAVUZ (Eylül 2026): öğrenci şubeyle süzülmez; iki şubenin personeli
 * bütün öğrencileri görür. Şube yalnız iki yerde devrede: grup tarafı
 * (aktif kapsam, program süzgeci) ve kullanıcının seçtiği kayıt şubesi
 * etiketi.
 */
export function ogrenciAramaKosulu(
  sorgu: string,
  {
    subeId,
    kapsam = "tumu",
    donemId,
    kulupId,
    kayitSubesiId,
  }: Pick<
    AramaSecenekleri,
    "subeId" | "kayitSubesiId" | "kapsam" | "donemId" | "kulupId"
  >,
): Prisma.StudentWhereInput {
  const temizSorgu = sorgu.trim();
  const isimAnahtari = normalizeArama(temizSorgu);
  const telefonAnahtari = normalizeTelefon(temizSorgu);

  // En az 3 rakam yoksa telefon araması yapılmaz; tek haneli bir rakam
  // yüzünden bütün velileri taramanın anlamı yok.
  const telefonAranabilir = telefonAnahtari.length >= 3;

  const aramaKosulu: Prisma.StudentWhereInput = temizSorgu
    ? {
        OR: [
          { searchName: { contains: isimAnahtari } },
          ...(telefonAranabilir
            ? [
                {
                  // Telefon artık `Veli` kaydında (§17.1); bağ tablosu
                  // üzerinden aranıyor.
                  guardians: {
                    some: {
                      veli: { searchPhone: { contains: telefonAnahtari } },
                    },
                  },
                },
              ]
            : []),
        ],
      }
    : {};

  // Program koşulu AYRI bir `AND` dalında: `kapsam === "aktif"` de
  // `enrollments`e koşul koyuyor ve tek anahtar altında ikisi birbirini
  // ezerdi. Grup şubesi ayrıca süzülü: program listesi çalışılan şubenin
  // gruplarını anlatır.
  const grupKosulu = donemId
    ? { termId: donemId, branchId: subeId }
    : kulupId
      ? { clubId: kulupId, branchId: subeId }
      : null;
  const programKosulu: Prisma.StudentWhereInput = grupKosulu
    ? { AND: [{ enrollments: { some: { status: "AKTIF", group: grupKosulu } } }] }
    : {};

  return {
    ...aramaKosulu,
    ...programKosulu,
    ...(kapsam === "aktif" ? aktifOgrenciKosulu(subeId) : {}),
    ...(kayitSubesiId ? { branchId: kayitSubesiId } : {}),
  };
}

/**
 * Bir sayfalık sonuç ve süzgece uyan TOPLAM sayı.
 *
 * Toplam ayrıca sayılıyor çünkü sayfa sayısı ondan çıkıyor; dönen dizinin
 * uzunluğu yalnızca o sayfayı anlatır. Liste eskiden 200'lük tek bir dilimdi
 * ve 200'e dayandığında "aramayı daraltın" diyordu — kurumun öğrenci sayısı
 * geçmiş veri aktarımıyla o sınırı aştı.
 */
export async function ogrenciAra(sorgu: string, secenekler: AramaSecenekleri) {
  const { enFazla = 50, atla = 0 } = secenekler;

  // Koşul TEK YERDE kuruluyor: liste ile sayım ayrı ayrı yazılsaydı biri
  // güncellenip diğeri unutulduğunda sayfa sayısı sessizce yanlış olurdu.
  const kosul = ogrenciAramaKosulu(sorgu, secenekler);

  // şube-muaf: öğrenciler ortak havuzda; kartlardaki kayıt sayısı
  // (`_count.enrollments`) bilerek iki şubenin kayıtlarını birlikte sayar.
  const [ogrenciler, toplam] = await Promise.all([
    db.student.findMany({
      where: kosul,
      // §6.2 — Aynı isimli öğrencileri ayırt edebilmek için doğum tarihi,
      // okul ve sınıf sonuçlarda gösterilir.
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        school: true,
        grade: true,
        branch: { select: { id: true, name: true } },
        guardians: {
          select: {
            type: true,
            veli: { select: { id: true, fullName: true, phone: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
      // Sıralama SAYFALAMANIN parçası: kararlı bir sıra olmadan aynı öğrenci
      // iki sayfada birden görünebilir ya da hiç görünmeyebilir. Ad-soyad
      // ikilisi eşitse `id` ayırıyor.
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      skip: atla,
      take: enFazla,
    }),
    db.student.count({ where: kosul }),
  ]);

  return { ogrenciler, toplam };
}
