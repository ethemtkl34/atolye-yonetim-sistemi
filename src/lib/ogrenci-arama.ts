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
 * Bir sayfalık sonuç ve süzgece uyan TOPLAM sayı.
 *
 * Toplam ayrıca sayılıyor çünkü sayfa sayısı ondan çıkıyor; dönen dizinin
 * uzunluğu yalnızca o sayfayı anlatır. Liste eskiden 200'lük tek bir dilimdi
 * ve 200'e dayandığında "aramayı daraltın" diyordu — kurumun öğrenci sayısı
 * geçmiş veri aktarımıyla o sınırı aştı.
 */
export async function ogrenciAra(sorgu: string, secenekler: AramaSecenekleri) {
  const { subeId, enFazla = 50, atla = 0, kapsam = "tumu" } = secenekler;
  const temizSorgu = sorgu.trim();
  const isimAnahtari = normalizeArama(temizSorgu);
  const telefonAnahtari = normalizeTelefon(temizSorgu);

  // En az 3 rakam yoksa telefon araması yapılmaz; tek haneli bir rakam
  // yüzünden bütün velileri taramanın anlamı yok.
  const telefonAranabilir = telefonAnahtari.length >= 3;

  const aramaKosulu = temizSorgu
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

  // Koşul TEK YERDE kuruluyor: liste ile sayım ayrı ayrı yazılsaydı biri
  // güncellenip diğeri unutulduğunda sayfa sayısı sessizce yanlış olurdu.
  const kosul = {
    ...aramaKosulu,
    ...(kapsam === "aktif" ? aktifOgrenciKosulu(subeId) : { branchId: subeId }),
  };

  // şube-muaf: süzgeç üç satır yukarıdaki `kosul` içinde — `kapsam`a göre ya
  // `branchId: subeId` ya da `aktifOgrenciKosulu(subeId)`. Tarayıcı `where`in
  // içine bakamadığı için burada muafiyet yazılı. Koşulun liste ve sayım
  // arasında ayrışmaması bilinçli: ikisi ayrı ayrı yazılsaydı biri
  // güncellenip diğeri unutulduğunda sayfa sayısı sessizce yanlış olurdu.
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
          select: { type: true, fullName: true, phone: true },
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
