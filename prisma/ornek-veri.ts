/**
 * Gerçekçi örnek veri.
 *
 * `npm run db:ornek-veri` ile çalışır. Amaç, raporlamanın ve dashboard
 * sayılarının gerçek bir dönem gibi görünen veriyle denenebilmesi.
 *
 * Başlangıç verisinden (`seed.ts`) farkı: seed kurumun kurulumda ihtiyaç
 * duyduğu asgari veridir (atölyeler, sorular, hesaplar) ve üretime de gider.
 * Bu dosya yalnızca deneme içindir; ürettiği öğrenciler tek tek adlarıyla
 * bilindiği için tekrar çalıştırıldığında önce silinip yeniden yazılır.
 * Elle eklediğiniz öğrencilere dokunmaz.
 *
 * PUANLAR RASTGELE DEĞİL. Her öğrencinin bir "profili" var (güçlü, dengeli,
 * gelişmekte, devamsız...) ve puanlar bu profilden sayısal olarak türetiliyor.
 * İki sebebi var:
 *
 *  1. Rapor motorunun kuralları ancak belirli profillerle sınanabilir —
 *     §11.3 "tek düşük puandan ağır yargı üretme" veya "üç oturumdan az
 *     katılımda ihtiyatlı yaz" kuralları ancak öyle bir öğrenci varsa görünür.
 *  2. Betik her çalıştığında aynı veriyi üretir; "dün gördüğüm rapor bugün
 *     neden başka" sorusu doğmaz.
 */
import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeArama, normalizeTelefon } from "../src/lib/turkce";

/** Geliştirme hesaplarının ortak parolası — `seed.ts` ile aynı. */
const GELISTIRME_SIFRESI = "Atolye2026!";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// Öğrenci profilleri
// ---------------------------------------------------------------------------

/**
 * Puan profili: her öğrencinin puanlarının nasıl dağılacağını belirler.
 *
 * `taban` o öğrencinin genel seviyesi, `dalgalanma` sorudan soruya sapma
 * payı. `zayifSorular` belirli soru sıralarında (0-tabanlı) puanı düşürür —
 * rapor motorunun "desteklenecek alan" çıkarımı ancak aynı soru birden çok
 * kez düşük puanlanırsa tetiklendiği için (§11.3) bu gerekli.
 */
type Profil = {
  ad: string;
  taban: number;
  dalgalanma: number;
  zayifSorular?: number[];
  gucluSorular?: number[];
  /** Katılmadığı oturumların sırası (0-tabanlı, gün×atölye düzleminde). */
  katilmadigi?: number[];
  /** "Değerlendirilemedi" işaretlenen oturum sıraları (serpiştirilmiş). */
  degerlendirilemeyen?: number[];
  /**
   * Hiçbir oturumda gözlemlenemeyen soru sıraları.
   *
   * Serpiştirilmiş "Değerlendirilemedi"ler raporda görünmüyor: aynı soru
   * başka bir oturumda puanlandığı için ortalama yine çıkıyor. Raporda
   * "—" satırının görülebilmesi için sorunun o atölyedeki bütün
   * oturumlarda boş kalması gerekiyor.
   */
  gozlemlenmeyenSorular?: number[];
  /** Yalnızca ilk N günün formu doldurulmuş; kalanı eksik bırakılır. */
  doldurulanGun?: number;
};

/**
 * `dalgalanma` bilinçli olarak geniş (0,8–1,0).
 *
 * İlk denemede 0,4–0,6 verilmişti; sonuç, bir öğrencinin bütün sorularından
 * aynı puanı alması oldu — 10 soru, 5 atölye, hepsi 4,0. Rapor teknik olarak
 * doğruydu ama hiçbir stajyerin böyle puanlamayacağı belliydi ve "güçlü/
 * desteklenecek alan" ayrımı da çıkmıyordu. Yuvarlama yapıldığı için sapma
 * payının en az ±0,8 olması gerekiyor ki komşu puanlara geçebilsin.
 */
const PROFILLER: Record<string, Profil> = {
  guclu: {
    ad: "Güçlü",
    taban: 4.4,
    dalgalanma: 0.8,
    gucluSorular: [0, 2, 9],
  },
  dengeli: {
    ad: "Dengeli",
    taban: 3.6,
    dalgalanma: 1.0,
  },
  gelismekte: {
    ad: "Gelişmekte",
    taban: 2.7,
    dalgalanma: 0.9,
    zayifSorular: [6, 9],
  },
  karma: {
    // Bazı sorularda güçlü, bazılarında desteklenmeli — raporun "güçlü yönler"
    // ve "desteklenecek alanlar" bölümlerinin ikisini birden doldurur.
    ad: "Karma",
    taban: 3.5,
    dalgalanma: 0.9,
    gucluSorular: [0, 1, 2],
    zayifSorular: [7, 8],
  },
  devamsiz: {
    ad: "Devamsız",
    taban: 3.4,
    dalgalanma: 0.9,
    // Oturum sırası = gün × 5 + atölye. İlk denemede [1, 3, 6, 7, 11]
    // verilmişti; 1, 6 ve 11 aynı atölyeye denk geldiği için öğrenci bütün
    // Robotik oturumlarını kaçırmış göründü ve o atölyenin ortalaması hiç
    // çıkmadı. Devamsızlık farklı gün ve atölyelere dağıtıldı.
    katilmadigi: [1, 5, 8, 12],
  },
  azVeri: {
    // Yalnızca ilk günün formları dolu → §11.3'ün "az sayıda değerlendirme
    // varsa metin ihtiyatlı olmalı" kuralını görünür kılar.
    ad: "Az veri",
    taban: 4.0,
    dalgalanma: 0.9,
    doldurulanGun: 1,
  },
  gozlemlenemeyen: {
    // "Değerlendirilemedi" — ortalamaya girmemeli ve olumsuz yorumlanmamalı
    // (§10.4, §11.3). 8. soru ("oran-orantı") hiç gözlemlenmemiş: raporda
    // "—" olarak görünür ve değerlendirilen soru sayısı 10 değil 9 olur.
    ad: "Gözlemlenemeyen alanlar",
    taban: 3.8,
    dalgalanma: 0.9,
    degerlendirilemeyen: [0, 2, 5, 9],
    gozlemlenmeyenSorular: [7],
  },
  eksikFormlu: {
    // İlk iki günü dolu, üçüncü gün boş → dashboard "eksik puanlama" sayacı
    // ve stajyer görev listesi denenebilsin.
    ad: "Eksik formlu",
    taban: 3.7,
    dalgalanma: 0.9,
    doldurulanGun: 2,
  },
  puanlanmamis: {
    // Hiç formu yok. Rapor üretilmek istenirse "veri yok" davranışı görülür.
    ad: "Puanlanmamış",
    taban: 0,
    dalgalanma: 0,
    doldurulanGun: 0,
  },
};

// ---------------------------------------------------------------------------
// Öğrenciler
// ---------------------------------------------------------------------------

type OgrenciTanimi = {
  ad: string;
  soyad: string;
  dogum: string;
  okul: string;
  sinif: string;
  anne?: { ad: string; tel: string };
  baba?: { ad: string; tel: string };
  saglik?: {
    alerji?: string;
    ilac?: string;
    ozelEgitim?: string;
    saglikNotu?: string;
    acil?: string;
    stajyerUyarisi?: string;
  };
  notlar?: string;
  profil: keyof typeof PROFILLER;
  /** Hangi programlara kaydedilecek. */
  kayitlar: ("donem-cumartesi" | "donem-pazar" | "kulup-sabah" | "kulup-oglen")[];
  stajyer: "ayse" | "mehmet" | "zeynep";
};

const OGRENCILER: OgrenciTanimi[] = [
  {
    ad: "Deniz", soyad: "Aydın", dogum: "2016-03-14",
    okul: "Fatih İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Elif Aydın", tel: "0532 244 18 90" },
    baba: { ad: "Kemal Aydın", tel: "0533 118 42 07" },
    profil: "guclu",
    kayitlar: ["donem-cumartesi", "kulup-sabah"],
    stajyer: "ayse",
  },
  {
    ad: "Zeynep", soyad: "Korkmaz", dogum: "2016-08-02",
    okul: "Atatürk İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Sevgi Korkmaz", tel: "0542 507 33 21" },
    profil: "dengeli",
    kayitlar: ["donem-cumartesi"],
    stajyer: "ayse",
  },
  {
    ad: "Ömer", soyad: "Şahin", dogum: "2017-01-27",
    okul: "Cumhuriyet İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Hatice Şahin", tel: "0505 661 74 12" },
    baba: { ad: "Yusuf Şahin", tel: "0555 210 96 38" },
    saglik: {
      alerji: "Polen alerjisi, bahar aylarında burun tıkanıklığı yapıyor.",
      stajyerUyarisi:
        "Bahçe etkinliklerinde burnu tıkanırsa içeri alınmalı ve koordinatöre haber verilmeli.",
    },
    profil: "karma",
    kayitlar: ["donem-cumartesi", "kulup-sabah"],
    stajyer: "ayse",
  },
  {
    ad: "Elif Naz", soyad: "Doğan", dogum: "2016-11-19",
    okul: "Fatih İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Merve Doğan", tel: "0538 402 15 63" },
    profil: "gelismekte",
    notlar:
      "Gruba yeni katıldı, ilk haftalarda çekingen davrandığı koordinatöre iletildi.",
    kayitlar: ["donem-cumartesi"],
    stajyer: "ayse",
  },
  {
    ad: "Mert", soyad: "Yalçın", dogum: "2015-06-08",
    okul: "Gazi İlkokulu", sinif: "5. sınıf",
    baba: { ad: "Serkan Yalçın", tel: "0544 873 20 45" },
    profil: "devamsiz",
    notlar: "Cumartesi sabahları servisle geliyor, zaman zaman gecikme oluyor.",
    kayitlar: ["donem-cumartesi"],
    stajyer: "ayse",
  },
  {
    ad: "Ada", soyad: "Türkmen", dogum: "2017-04-30",
    okul: "Atatürk İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Pınar Türkmen", tel: "0537 190 55 82" },
    baba: { ad: "Barış Türkmen", tel: "0532 774 61 09" },
    profil: "gozlemlenemeyen",
    kayitlar: ["donem-cumartesi", "kulup-oglen"],
    stajyer: "mehmet",
  },
  {
    ad: "Kerem", soyad: "Aksoy", dogum: "2016-09-21",
    okul: "Cumhuriyet İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Nurcan Aksoy", tel: "0543 328 47 16" },
    saglik: {
      ilac: "Astım için gerektiğinde inhaler kullanıyor.",
      acil: "İnhaler çantasında. Nefes darlığında kullandırılıp veli aranmalı.",
      stajyerUyarisi:
        "Astımı var. Nefes darlığı olursa etkinliği durdurup koordinatörü çağırın.",
    },
    profil: "dengeli",
    kayitlar: ["donem-cumartesi"],
    stajyer: "mehmet",
  },
  {
    ad: "Nehir", soyad: "Balcı", dogum: "2017-02-11",
    okul: "Gazi İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Gamze Balcı", tel: "0531 604 29 73" },
    profil: "azVeri",
    notlar: "Döneme üçüncü haftada katıldı.",
    kayitlar: ["donem-cumartesi"],
    stajyer: "mehmet",
  },
  {
    ad: "Yiğit", soyad: "Erdem", dogum: "2015-12-05",
    okul: "Fatih İlkokulu", sinif: "5. sınıf",
    baba: { ad: "Tolga Erdem", tel: "0546 915 38 24" },
    profil: "eksikFormlu",
    kayitlar: ["donem-cumartesi"],
    stajyer: "mehmet",
  },
  {
    ad: "Masal", soyad: "Güneş", dogum: "2016-07-16",
    okul: "Atatürk İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Ebru Güneş", tel: "0535 481 70 92" },
    profil: "guclu",
    kayitlar: ["donem-cumartesi", "kulup-oglen"],
    stajyer: "mehmet",
  },
  {
    ad: "Poyraz", soyad: "Ünal", dogum: "2017-05-23",
    okul: "Cumhuriyet İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Selin Ünal", tel: "0530 267 84 51" },
    baba: { ad: "Onur Ünal", tel: "0541 359 12 66" },
    saglik: {
      ozelEgitim: "Dikkat eksikliği için haftada bir destek eğitimi alıyor.",
      saglikNotu: "Uzun süreli oturmalarda dikkati dağılıyor, ara verilmesi öneriliyor.",
      stajyerUyarisi:
        "Uzun etkinliklerde kısa aralar verilmesi yararlı oluyor.",
    },
    profil: "gelismekte",
    kayitlar: ["donem-cumartesi"],
    stajyer: "zeynep",
  },

  // --- Pazar grubu: dönem başladıktan sonra açıldı (4. haftadan başlıyor).
  // Geçmiş oturumu olmadığı için puanı da yok; "gelecek oturumlar eksik
  // puanlama sayılmaz" kuralı burada denenebilir.
  {
    ad: "Bulut", soyad: "Aslan", dogum: "2016-10-08",
    okul: "Gazi İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Derya Aslan", tel: "0539 726 40 18" },
    profil: "puanlanmamis",
    kayitlar: ["donem-pazar"],
    stajyer: "zeynep",
  },
  {
    ad: "Duru", soyad: "Kaplan", dogum: "2017-03-02",
    okul: "Fatih İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Şeyma Kaplan", tel: "0534 158 93 47" },
    profil: "puanlanmamis",
    kayitlar: ["donem-pazar"],
    stajyer: "zeynep",
  },
  {
    ad: "Alp", soyad: "Kurt", dogum: "2015-09-14",
    okul: "Atatürk İlkokulu", sinif: "5. sınıf",
    baba: { ad: "Cem Kurt", tel: "0547 302 66 85" },
    profil: "puanlanmamis",
    kayitlar: ["donem-pazar"],
    stajyer: "zeynep",
  },
  {
    ad: "İnci", soyad: "Özkan", dogum: "2016-12-26",
    okul: "Cumhuriyet İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Melis Özkan", tel: "0536 940 27 13" },
    profil: "puanlanmamis",
    kayitlar: ["donem-pazar"],
    stajyer: "ayse",
  },

  // --- Yalnızca kulüp öğrencileri (dönem grubuna dahil değil, §13.7).
  {
    ad: "Çınar", soyad: "Bilgin", dogum: "2016-05-11",
    okul: "Gazi İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Aslı Bilgin", tel: "0533 815 49 20" },
    profil: "guclu",
    kayitlar: ["kulup-sabah"],
    stajyer: "mehmet",
  },
  {
    ad: "Ilgaz", soyad: "Sarı", dogum: "2017-07-04",
    okul: "Fatih İlkokulu", sinif: "3. sınıf",
    baba: { ad: "Hakan Sarı", tel: "0545 673 21 58" },
    profil: "dengeli",
    kayitlar: ["kulup-sabah"],
    stajyer: "mehmet",
  },
  {
    ad: "Ayaz", soyad: "Demirtaş", dogum: "2016-01-09",
    okul: "Atatürk İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Filiz Demirtaş", tel: "0532 486 05 77" },
    profil: "karma",
    kayitlar: ["kulup-oglen"],
    stajyer: "zeynep",
  },
];

// ---------------------------------------------------------------------------
// Deterministik sayı üretimi
// ---------------------------------------------------------------------------

/**
 * Tohumlu (deterministik) sözde-rastgele üretici — mulberry32.
 *
 * `Math.random()` kullanılsaydı betik her çalıştığında farklı puanlar üretir,
 * "aynı veriden aynı rapor çıkar" varsayımı denenemezdi.
 */
function uretici(tohum: number) {
  let durum = tohum >>> 0;
  return () => {
    durum = (durum + 0x6d2b79f5) >>> 0;
    let t = durum;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Metinden sabit bir tohum üretir; aynı öğrenci hep aynı puanları alır. */
function tohumla(metin: string): number {
  let h = 2166136261;
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function puanUret(
  profil: Profil,
  soruSirasi: number,
  rastgele: () => number,
): number {
  let taban = profil.taban;
  if (profil.gucluSorular?.includes(soruSirasi)) taban += 0.8;
  if (profil.zayifSorular?.includes(soruSirasi)) taban -= 1.1;

  const sapma = (rastgele() - 0.5) * 2 * profil.dalgalanma;
  const ham = Math.round(taban + sapma);
  return Math.min(5, Math.max(1, ham));
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Örnek veri yükleniyor...\n");

  // --- Stajyer hesapları ---------------------------------------------------
  // Üçüncü stajyer buradan ekleniyor: iki stajyerle atama listesi gerçekçi
  // görünmüyor, §8'in "stajyer başına öğrenci sayısı" ekranı denenemiyordu.
  const parolaHash = await hash(GELISTIRME_SIFRESI, 12);

  const stajyerler = {
    ayse: await db.user.findUnique({ where: { email: "ayse@tuzder.local" } }),
    mehmet: await db.user.findUnique({
      where: { email: "mehmet@tuzder.local" },
    }),
    zeynep: await db.user.upsert({
      where: { email: "zeynep@tuzder.local" },
      update: { name: "Zeynep Demir", role: "STAJYER", active: true },
      create: {
        email: "zeynep@tuzder.local",
        name: "Zeynep Demir",
        role: "STAJYER",
        passwordHash: parolaHash,
      },
    }),
  };

  if (!stajyerler.ayse || !stajyerler.mehmet) {
    throw new Error(
      "Stajyer hesapları bulunamadı. Önce `npm run db:seed` çalıştırın.",
    );
  }

  // --- Gruplar -------------------------------------------------------------
  const donem = await db.term.findFirst({
    orderBy: { createdAt: "asc" },
    include: { groups: { orderBy: { createdAt: "asc" } } },
  });
  const kulup = await db.club.findFirst({
    orderBy: { createdAt: "asc" },
    include: { groups: { orderBy: { createdAt: "asc" } } },
  });

  if (!donem || donem.groups.length < 2 || !kulup || kulup.groups.length < 2) {
    throw new Error(
      "Dönem veya kulüp grupları eksik. Arayüzden bir dönem (2 grup) ve bir kulüp (2 grup) oluşturun.",
    );
  }

  const gruplar = {
    "donem-cumartesi": donem.groups[0],
    "donem-pazar": donem.groups[1],
    "kulup-sabah": kulup.groups[0],
    "kulup-oglen": kulup.groups[1],
  };

  // --- Eski örnek öğrencileri temizle --------------------------------------
  // Yalnızca bu dosyanın ürettiği adlar siliniyor; elle eklenen öğrenciler
  // ve başlangıç verisinden gelen Şule/İpek yerinde kalıyor.
  const eskiler = await db.student.findMany({
    where: {
      OR: OGRENCILER.map((o) => ({
        firstName: o.ad,
        lastName: o.soyad,
      })),
    },
    select: { id: true },
  });

  if (eskiler.length > 0) {
    const idler = eskiler.map((o) => o.id);
    // ReportPdf → Report bağı `Restrict`; önce PDF'ler, sonra raporlar.
    await db.reportPdf.deleteMany({
      where: { report: { studentId: { in: idler } } },
    });
    await db.report.deleteMany({ where: { studentId: { in: idler } } });
    await db.student.deleteMany({ where: { id: { in: idler } } });
    console.log(`· ${eskiler.length} eski örnek öğrenci silindi`);
  }

  // --- Öğrenciler, kayıtlar, puanlar ---------------------------------------
  let kayitSayisi = 0;
  let puanSayisi = 0;
  let cevapSayisi = 0;

  for (const tanim of OGRENCILER) {
    const ogrenci = await db.student.create({
      data: {
        firstName: tanim.ad,
        lastName: tanim.soyad,
        birthDate: new Date(`${tanim.dogum}T00:00:00.000Z`),
        school: tanim.okul,
        grade: tanim.sinif,
        notes: tanim.notlar,
        searchName: normalizeArama(`${tanim.ad} ${tanim.soyad}`),
        guardians: {
          create: [
            ...(tanim.anne
              ? [
                  {
                    type: "ANNE" as const,
                    fullName: tanim.anne.ad,
                    phone: tanim.anne.tel,
                    searchPhone: normalizeTelefon(tanim.anne.tel),
                  },
                ]
              : []),
            ...(tanim.baba
              ? [
                  {
                    type: "BABA" as const,
                    fullName: tanim.baba.ad,
                    phone: tanim.baba.tel,
                    searchPhone: normalizeTelefon(tanim.baba.tel),
                  },
                ]
              : []),
          ],
        },
        ...(tanim.saglik
          ? {
              healthInfo: {
                create: {
                  allergies: tanim.saglik.alerji,
                  medications: tanim.saglik.ilac,
                  specialEducation: tanim.saglik.ozelEgitim,
                  healthNotes: tanim.saglik.saglikNotu,
                  emergencyInfo: tanim.saglik.acil,
                  internSafetyNote: tanim.saglik.stajyerUyarisi,
                },
              },
            }
          : {}),
      },
    });

    const profil = PROFILLER[tanim.profil];

    for (const grupAnahtari of tanim.kayitlar) {
      const grup = gruplar[grupAnahtari];

      const kayit = await db.enrollment.create({
        data: {
          studentId: ogrenci.id,
          groupId: grup.id,
          internId: stajyerler[tanim.stajyer]!.id,
          status: "AKTIF",
        },
      });
      kayitSayisi++;

      // Yalnızca yapılmış oturumlar puanlanır — gelecek tarihli oturumun
      // formu uygulamada da kilitli (§10.5 yorumu, P7).
      const oturumlar = await db.session.findMany({
        where: { groupId: grup.id, date: { lte: new Date() } },
        orderBy: [{ date: "asc" }, { workshopType: { sortOrder: "asc" } }],
        include: {
          workshopType: {
            include: {
              questions: {
                where: { active: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });

      // Gün sayısı, "ilk N günü doldur" profilleri için gerekiyor.
      const gunler = [...new Set(oturumlar.map((o) => o.date.toISOString()))];
      const rastgele = uretici(tohumla(`${ogrenci.id}-${grup.id}`));

      for (const [sira, oturum] of oturumlar.entries()) {
        const gunSirasi = gunler.indexOf(oturum.date.toISOString());

        // Form hiç doldurulmamış: satır yazılmaz (uygulamada "Eksik" görünür).
        if (
          profil.doldurulanGun !== undefined &&
          gunSirasi >= profil.doldurulanGun
        ) {
          continue;
        }

        const katilmadi = profil.katilmadigi?.includes(sira) ?? false;

        const puanlama = await db.score.create({
          data: {
            sessionId: oturum.id,
            enrollmentId: kayit.id,
            attended: !katilmadi,
            scoredByUserId: stajyerler[tanim.stajyer]!.id,
          },
        });
        puanSayisi++;

        // §10.2 — Katılmadıysa cevap satırı hiç yazılmaz.
        if (katilmadi) continue;

        const degerlendirilemez =
          profil.degerlendirilemeyen?.includes(sira) ?? false;

        await db.scoreAnswer.createMany({
          data: oturum.workshopType.questions.map((soru, soruSirasi) => ({
            scoreId: puanlama.id,
            questionId: soru.id,
            questionTextSnapshot: soru.text,
            sortOrder: soruSirasi,
            // "Değerlendirilemedi" bütün soruya değil, birkaç soruya konur;
            // gerçekte de stajyer tek tek işaretliyor.
            value:
              profil.gozlemlenmeyenSorular?.includes(soruSirasi) ||
              (degerlendirilemez && soruSirasi % 3 === 1)
                ? null
                : puanUret(profil, soruSirasi, rastgele),
          })),
        });
        cevapSayisi += oturum.workshopType.questions.length;
      }
    }
  }

  // --- Özet ----------------------------------------------------------------
  const toplamOgrenci = await db.student.count();
  const doluluk = await Promise.all(
    Object.entries(gruplar).map(async ([anahtar, grup]) => {
      const sayi = await db.enrollment.count({
        where: { groupId: grup.id, status: "AKTIF" },
      });
      return `    ${anahtar.padEnd(17)} ${sayi}/${grup.capacity}`;
    }),
  );

  console.log(`✓ ${OGRENCILER.length} örnek öğrenci`);
  console.log(`✓ ${kayitSayisi} kayıt`);
  console.log(`✓ ${puanSayisi} puanlama formu, ${cevapSayisi} cevap satırı`);
  console.log(`\n  Grup doluluğu:\n${doluluk.join("\n")}`);
  console.log(`\n  Veritabanındaki toplam öğrenci: ${toplamOgrenci}`);
  console.log("\n  Denemeye değer profiller:");
  for (const tanim of OGRENCILER) {
    const p = PROFILLER[tanim.profil];
    if (
      ["azVeri", "gozlemlenemeyen", "devamsiz", "eksikFormlu", "puanlanmamis", "karma"].includes(
        tanim.profil,
      )
    ) {
      console.log(`    ${`${tanim.ad} ${tanim.soyad}`.padEnd(20)} ${p.ad}`);
    }
  }
}

main()
  .catch((hata) => {
    console.error("\nÖrnek veri yüklenemedi:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
