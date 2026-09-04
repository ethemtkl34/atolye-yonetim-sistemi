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
   * Zorunlu. Öğrenci arama sistemdeki tek öğrenci giriş kapısı; şube burada
   * unutulursa bütün ekranlar sızdırır. Bu yüzden varsayılanı yok.
   */
  subeId: string;
  enFazla?: number;
  /** Sayfalama için atlanacak kayıt sayısı. */
  atla?: number;
  /**
   * "aktif" seçilirse yalnızca aktif bir programda aktif kaydı olan öğrenciler
   * döner — dashboardun "Aktif öğrenci" kartının karşılığı (§12.1).
   */
  kapsam?: "tumu" | "aktif";
};

/**
 * Aramanın `where` koşulu — sorgudan ve şubeden türetilen SAF parça.
 *
 * `ogrenciAra`nın içinden ayrı bir fonksiyona alındı çünkü şube süzgecinin
 * burada durduğunu doğrulayabilen başka bir kontrol yok: `sube-sizinti`
 * tarayıcısı `where`in içine bakamadığı için bu çağrı ona "şube-muaf" olarak
 * yazılı. Ayrı fonksiyon olunca koşul testten okunabiliyor
 * (`ogrenci-arama.test.ts`).
 */
export function ogrenciAramaKosulu(
  sorgu: string,
  { subeId, kapsam = "tumu" }: Pick<AramaSecenekleri, "subeId" | "kapsam">,
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

  return {
    ...aramaKosulu,
    ...(kapsam === "aktif" ? aktifOgrenciKosulu(subeId) : { branchId: subeId }),
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

  // şube-muaf: süzgeç `ogrenciAramaKosulu` içinde — `kapsam`a göre ya
  // `branchId: subeId` ya da `aktifOgrenciKosulu(subeId)`. Tarayıcı `where`in
  // içine bakamadığı için burada muafiyet yazılı; koşulun kendisi
  // `ogrenci-arama.test.ts` tarafından doğrulanıyor.
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
