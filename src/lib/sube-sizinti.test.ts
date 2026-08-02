import { describe, expect, it } from "vitest";
import { metniTara, subeSizintisiTara } from "./sube-sizinti";

/**
 * Bu testin iki işi var ve ikisi de gerekli:
 *
 * 1. Kod tabanında şube süzgeci unutulmuş sorgu kalmadığını doğrulamak.
 * 2. Tarayıcının GERÇEKTEN yakaladığını göstermek. Yalnızca birincisi olsaydı,
 *    bozuk bir tarayıcı da "temiz" derdi. Aşağıdaki örnekler uydurma değil:
 *    hepsi bu projede yaşanmış, canlıda gözle bulunmuş sızıntıların sadeleşmiş
 *    hâli.
 */

describe("kod tabanı", () => {
  it("şube süzgeci unutulmuş sorgu yok", () => {
    const bulgular = subeSizintisiTara("src");

    // Hata mesajı listeyi tam versin: bulgu çıktığında geliştiricinin
    // dosyaları tek tek aramasına gerek kalmasın.
    const rapor = bulgular
      .map((b) => `\n  ${b.yol}:${b.satir}  ${b.model}.${b.metot}\n    ${b.gerekce}`)
      .join("");

    expect(bulgular.length, `Şube süzgeci taşımayan sorgu(lar):${rapor}\n`).toBe(
      0,
    );
  });
});

describe("yaşanmış sızıntılar yakalanıyor", () => {
  it("iç içe okuma: dönem listesi grupları süzgeçsiz okuyordu", () => {
    // Dönem ve kulüp listeleri ile arşiv ekranı, dönemi şubesiz (doğru) okuyup
    // `include` içinde grupları süzgeçsiz getiriyordu: diğer şubenin grup
    // sayısı listeye ekleniyor, stajyer adları görünüyordu.
    const bulgular = metniTara(`
      export async function donemler(subeId: string) {
        const kullanici = await yonetimZorunlu();
        return db.term.findMany({
          where: { status: { not: "ARSIVLENDI" } },
          include: { groups: { select: { name: true } } },
        });
      }
    `);

    expect(bulgular).toHaveLength(1);
    expect(bulgular[0]?.gerekce).toMatch(/İç içe okuma/);
  });

  it("iç içe sayım: şubesiz `_count` sayıyı şişiriyordu", () => {
    const bulgular = metniTara(`
      export async function kulupler(subeId: string) {
        return db.club.findMany({
          where: { status: "KAYIT_ALIYOR" },
          include: { _count: { select: { groups: true } } },
        });
      }
    `);

    expect(bulgular).toHaveLength(1);
  });

  it("küme silme: `notIn` doğrulanmış üst kayıt sayılmaz", () => {
    // Gerçek veri kaybı hatası. Dönem iki şubede ortaklaşınca bu satır, formu
    // gönderen şubenin seçmediği HERKESİ — yani diğer şubenin bütün kadrosunu —
    // siliyordu. Fonksiyonun başka yerinde `subeId` geçmesi kurtarmıyor;
    // `userId: { notIn }` tek bir doğrulanmış kayda çapa değildir.
    const bulgular = metniTara(`
      export async function kadroyuGuncelle(donemId: string, subeId: string) {
        const secilenler = await stajyerleriDogrula(idler, subeId);
        await db.termIntern.deleteMany({
          where: { termId: donemId, userId: { notIn: secilenler } },
        });
      }
    `);

    expect(bulgular).toHaveLength(1);
  });

  it("kimliği tahmin edilebilen kayıt: şube kontrolsüz PDF rotası", () => {
    // Rapor PDF'i yalnızca oturumdaki role bakıyordu; başka şubenin rapor
    // id'si adrese yazılınca o şubenin öğrenci raporunu servis ediyordu.
    const bulgular = metniTara(`
      export async function GET(istek: Request, { params }) {
        const oturum = await auth();
        const pdf = await db.reportPdf.findFirst({ where: { id: params.id } });
        return yanit(pdf);
      }
    `);

    expect(bulgular).toHaveLength(1);
  });
});

describe("doğru yazılmış sorgular bulgu üretmiyor", () => {
  it("süzgeç çağrının kendisinde", () => {
    expect(
      metniTara(`
        export async function gruplar(subeId: string) {
          return db.group.findMany({ where: { branchId: subeId } });
        }
      `),
    ).toEqual([]);
  });

  it("iç içe okuma da süzülmüşse", () => {
    expect(
      metniTara(`
        export async function donemler(subeId: string) {
          return db.term.findMany({
            include: { groups: { where: { branchId: subeId } } },
          });
        }
      `),
    ).toEqual([]);
  });

  it("önce kapıdan geçip sonra birincil anahtarla güncelleme", () => {
    // Kod tabanındaki en yaygın deyim: şube süzgeçli `findFirst` ile varlık
    // doğrulanır, sonra `id` ile güncellenir.
    expect(
      metniTara(`
        export async function grupAdiGuncelle(grupId: string) {
          const kullanici = await yonetimZorunlu();
          const grup = await db.group.findFirst({
            where: { id: grupId, branchId: kullanici.aktifSubeId },
          });
          if (!grup) return;
          await db.group.update({ where: { id: grupId }, data: { name: "x" } });
        }
      `),
    ).toEqual([]);
  });

  it("doğrulanmış üst kayda çapalı küme sorgusu", () => {
    expect(
      metniTara(`
        export async function gunuSil(grupId: string) {
          const kullanici = await yonetimZorunlu();
          const grup = await grubuOku(grupId, kullanici.aktifSubeId);
          if (!grup) return;
          await db.session.deleteMany({ where: { groupId: grupId } });
        }
      `),
    ).toEqual([]);
  });

  it("yönetici eylemleri şubeler üstü", () => {
    expect(
      metniTara(`
        export async function kullanicilar() {
          await adminZorunlu();
          return db.user.findMany({ orderBy: { name: "asc" } });
        }
      `),
    ).toEqual([]);
  });
});

describe("muafiyet", () => {
  const SIZAN = `
    export async function hepsi() {
      return db.student.findMany({ orderBy: { lastName: "asc" } });
    }
  `;

  it("gerekçeli muafiyet bulguyu susturur", () => {
    const muaf = SIZAN.replace(
      "return db.student",
      "// şube-muaf: sayfa yalnızca yönetici raporu üretiyor\n      return db.student",
    );

    expect(metniTara(SIZAN)).toHaveLength(1);
    expect(metniTara(muaf)).toEqual([]);
  });

  it("gerekçesiz muafiyet susturmaz", () => {
    // Boş bir `// şube-muaf:` kaçış yolu olurdu: kural, kararın yazıya
    // dökülmesini istiyor.
    const gerekcesiz = SIZAN.replace(
      "return db.student",
      "// şube-muaf:\n      return db.student",
    );

    expect(metniTara(gerekcesiz)).toHaveLength(1);
  });
});
