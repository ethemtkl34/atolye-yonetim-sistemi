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
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeArama, normalizeTelefon } from "../src/lib/turkce";
import {
  donemOturumlariniUret,
  kulupOturumlariniUret,
} from "../src/lib/session-generator";
import { gunundenGun } from "../src/lib/tarih";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Yerel mi uzak mı?
 *
 * Betiğin iki davranışı buna bağlı: eski örnek öğrencileri silme ve deneme
 * stajyerlerine sabit parola verme. İkisi de yerelde zararsız, uzakta
 * tehlikeli.
 */
function yerelVeritabaniMi(): boolean {
  const adres = process.env.DATABASE_URL ?? "";
  return adres.includes("localhost") || adres.includes("127.0.0.1");
}

/**
 * Deneme stajyerlerinin parolası.
 *
 * Yerelde seed ile aynı sabit parola — iki betik aynı hesapları açtığında
 * giriş bilgisi değişmesin. Uzakta sabit parola kullanılamaz (depo herkese
 * açık): rastgele üretilir ve çalışma sonunda bir kez ekrana basılır.
 */
const YEREL_SIFRE = "Atolye2026!";
let uretilenSifre: string | null = null;

function stajyerParolasi(): string {
  if (process.env.ORNEK_VERI_SIFRESI) return process.env.ORNEK_VERI_SIFRESI;
  if (yerelVeritabaniMi()) return YEREL_SIFRE;
  uretilenSifre ??= randomBytes(12).toString("base64url");
  return uretilenSifre;
}

/** Bu çalışmada açılan stajyer hesapları — sonunda özet yazmak için. */
const acilanHesaplar: string[] = [];

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
  /** Sorumlu stajyerin e-posta öneki — şubeye göre farklı isimler. */
  stajyer: string;
};

const UMRANIYE_OGRENCILERI: OgrenciTanimi[] = [
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

/**
 * Güneşli şubesinin öğrencileri.
 *
 * Ümraniye'ye göre kasten daha küçük bir set: amaç ikinci şubeyi doldurmak
 * değil, ŞUBE İZOLASYONUNU denenebilir kılmak. Ümraniye koordinatörü bu
 * öğrencileri hiçbir ekranda görmemeli; adları da bilerek Ümraniye
 * listesindekilerden farklı, karışırsa fark edilsin diye.
 */
const GUNESLI_OGRENCILERI: OgrenciTanimi[] = [
  {
    ad: "Kaan", soyad: "Yücel", dogum: "2016-04-11",
    okul: "Güneşli İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Nazan Yücel", tel: "0532 907 61 24" },
    baba: { ad: "Serkan Yücel", tel: "0533 415 08 77" },
    profil: "guclu",
    kayitlar: ["donem-cumartesi", "kulup-sabah"],
    stajyer: "elif",
  },
  {
    ad: "Defne", soyad: "Arslan", dogum: "2016-11-23",
    okul: "Güneşli İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Pınar Arslan", tel: "0505 213 44 96" },
    profil: "dengeli",
    kayitlar: ["donem-cumartesi"],
    stajyer: "elif",
  },
  {
    ad: "Tuna", soyad: "Kılıçarslan", dogum: "2017-02-08",
    okul: "Bağcılar İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Melis Kılıçarslan", tel: "0542 778 30 15" },
    baba: { ad: "Onur Kılıçarslan", tel: "0543 220 91 63" },
    saglik: {
      alerji: "Polen alerjisi; bahar aylarında burun tıkanıklığı olabiliyor.",
      stajyerUyarisi:
        "Polen alerjisi var. Açık havada uzun süreli etkinlikte öğretmene haber verin.",
    },
    profil: "karma",
    kayitlar: ["donem-cumartesi", "kulup-oglen"],
    stajyer: "burak",
  },
  {
    ad: "Zehra", soyad: "Toprak", dogum: "2016-06-30",
    okul: "Bağcılar İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Sibel Toprak", tel: "0555 634 27 80" },
    profil: "gelismekte",
    kayitlar: ["donem-pazar"],
    stajyer: "burak",
  },
  {
    ad: "Emir", soyad: "Sarıkaya", dogum: "2017-09-05",
    okul: "Güneşli İlkokulu", sinif: "3. sınıf",
    baba: { ad: "Hakan Sarıkaya", tel: "0536 401 55 38" },
    profil: "devamsiz",
    kayitlar: ["donem-pazar"],
    stajyer: "selin",
  },
  {
    ad: "Nisan", soyad: "Özdemir", dogum: "2016-12-19",
    okul: "Kirazlı İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Gamze Özdemir", tel: "0507 862 19 45" },
    profil: "azVeri",
    kayitlar: ["donem-pazar"],
    stajyer: "selin",
  },
  {
    ad: "Berk", soyad: "Yalçınkaya", dogum: "2017-03-27",
    okul: "Kirazlı İlkokulu", sinif: "3. sınıf",
    anne: { ad: "Tuğba Yalçınkaya", tel: "0538 116 73 20" },
    profil: "eksikFormlu",
    kayitlar: ["donem-cumartesi"],
    stajyer: "elif",
  },
  {
    ad: "Ela", soyad: "Bozkurt", dogum: "2016-08-14",
    okul: "Güneşli İlkokulu", sinif: "4. sınıf",
    anne: { ad: "Şeyma Bozkurt", tel: "0544 350 62 91" },
    profil: "puanlanmamis",
    kayitlar: ["kulup-sabah"],
    stajyer: "selin",
  },
];

/** Şube başına örnek veri tanımı. */
type SubeSeti = {
  subeId: string;
  ad: string;
  ogrenciler: OgrenciTanimi[];
  /**
   * Öğrenci tanımındaki `stajyer` anahtarı → hesap.
   *
   * Ad da burada duruyor çünkü betik hesabı yoksa kendisi açıyor: seed
   * deneme stajyerlerini yalnızca yerel makinede oluşturuyor, uzak
   * veritabanında bu liste boş kalırdı.
   */
  stajyerler: Record<string, { eposta: string; ad: string }>;
};

const SUBE_SETLERI: SubeSeti[] = [
  {
    subeId: "sube_umraniye",
    ad: "Ümraniye Tüzder",
    ogrenciler: UMRANIYE_OGRENCILERI,
    stajyerler: {
      ayse: { eposta: "ayse@tuzder.local", ad: "Ayşe Yılmaz" },
      mehmet: { eposta: "mehmet@tuzder.local", ad: "Mehmet Kaya" },
      zeynep: { eposta: "zeynep@tuzder.local", ad: "Zeynep Demir" },
    },
  },
  {
    subeId: "sube_gunesli",
    ad: "Güneşli Tüzder",
    ogrenciler: GUNESLI_OGRENCILERI,
    stajyerler: {
      elif: { eposta: "elif@tuzder.local", ad: "Elif Şahin" },
      burak: { eposta: "burak@tuzder.local", ad: "Burak Yıldırım" },
      selin: { eposta: "selin@tuzder.local", ad: "Selin Aktaş" },
    },
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

// ---------------------------------------------------------------------------
// Şube başına veri üretimi
// ---------------------------------------------------------------------------

/**
 * Bir şubenin dönem ve kulüp gruplarını hazırlar; yoksa oluşturur.
 *
 * Dönem ve kulüp ORTAK (tek kayıt), gruplar şubeye ait. İkinci şube açıldığında
 * onun grupları henüz yok — arayüzden tek tek açmak yerine burada üretiliyor,
 * oturumlarıyla birlikte, uygulamadaki üreticinin aynısıyla.
 */
async function gruplariSagla(
  set: SubeSeti,
  donem: { id: string; weeks: { id: string; weekNumber: number; date: Date }[]; workshops: { workshopTypeId: string }[] },
  kulup: {
    id: string;
    date: Date;
    weekDates: Date[];
    workshops: { workshopTypeId: string }[];
  },
) {
  const atolyeIdleri = donem.workshops.map((a) => a.workshopTypeId);

  async function donemGrubu(ad: string, gun: "CUMARTESI" | "PAZAR", kontenjan: number) {
    const mevcut = await db.group.findFirst({
      where: { termId: donem.id, branchId: set.subeId, days: { has: gun } },
    });
    if (mevcut) return mevcut;

    const grup = await db.group.create({
      data: {
        termId: donem.id,
        branchId: set.subeId,
        name: ad,
        days: [gun],
        timeSlot: "OGLEDEN_ONCE",
        capacity: kontenjan,
        startWeekNumber: 1,
      },
    });
    const oturumlar = donemOturumlariniUret({
      haftalar: donem.weeks,
      atolyeIdleri,
      grupGunleri: [gun],
      baslangicHaftasi: 1,
    });
    await db.session.createMany({
      data: oturumlar.map((o) => ({ ...o, groupId: grup.id })),
    });
    return grup;
  }

  async function kulupGrubu(ad: string, dilim: "OGLEDEN_ONCE" | "OGLEDEN_SONRA", kontenjan: number) {
    const mevcut = await db.group.findFirst({
      where: { clubId: kulup.id, branchId: set.subeId, timeSlot: dilim },
    });
    if (mevcut) return mevcut;

    const gun = gunundenGun(kulup.date);

    const grup = await db.group.create({
      data: {
        clubId: kulup.id,
        branchId: set.subeId,
        name: ad,
        days: [gun],
        timeSlot: dilim,
        capacity: kontenjan,
        startWeekNumber: 1,
      },
    });
    const oturumlar = kulupOturumlariniUret({
      // Kulüp artık haftalara yayılabiliyor; eski kayıtlarda liste boşsa tek
      // gün olarak davranılıyor.
      tarihler: kulup.weekDates.length > 0 ? kulup.weekDates : [kulup.date],
      atolyeIdleri: kulup.workshops.map((a) => a.workshopTypeId),
    });
    await db.session.createMany({
      data: oturumlar.map((o) => ({ ...o, groupId: grup.id })),
    });
    return grup;
  }

  return {
    "donem-cumartesi": await donemGrubu("1. Grup", "CUMARTESI", 12),
    "donem-pazar": await donemGrubu("2. Grup", "PAZAR", 12),
    "kulup-sabah": await kulupGrubu("1. Grup", "OGLEDEN_ONCE", 12),
    "kulup-oglen": await kulupGrubu("2. Grup", "OGLEDEN_SONRA", 8),
  };
}

/**
 * Uzak veritabanında yazılabilecek şubeleri seçer — YAZMA BAŞLAMADAN.
 *
 * Karar ŞUBE BAZINDA: çakışan şube atlanır, temiz şube yazılır. Önce
 * "herhangi bir şubede çakışma varsa hiçbir şey yapma" diye yazmıştım ve bu
 * asıl kullanım senaryosunu engelliyordu — kurumun eski verisi bir şubede
 * duruyor, yeni açılan şube bomboş ve doldurulmak isteniyor. Alakasız bir
 * şubedeki çakışma yüzünden boş şubeyi dolduramamak işe yaramaz bir katılık.
 *
 * Denetimin şube döngüsünün dışında olması yine de şart: içeride olsaydı
 * ikinci şubede fark edilen bir çakışma, birinci şubeye çoktan yazılmış
 * öğrencileri geride bırakırdı.
 */
async function yazilabilirSubeler(setler: SubeSeti[]): Promise<SubeSeti[]> {
  const yazilabilir: SubeSeti[] = [];

  for (const set of setler) {
    const cakisanlar = await db.student.findMany({
      where: {
        branchId: set.subeId,
        OR: set.ogrenciler.map((o) => ({ firstName: o.ad, lastName: o.soyad })),
      },
      select: { firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (cakisanlar.length === 0) {
      yazilabilir.push(set);
      continue;
    }

    console.log(
      `\n⚠ ${set.ad} ATLANIYOR — örnek veriyle aynı adlı ` +
        `${cakisanlar.length} öğrenci var:`,
    );
    for (const o of cakisanlar.slice(0, 8)) {
      console.log(`    · ${o.firstName} ${o.lastName}`);
    }
    if (cakisanlar.length > 8) {
      console.log(`    · … ve ${cakisanlar.length - 8} kişi daha`);
    }
    console.log(
      "  Yerelde bunlar silinip yeniden yazılırdı; uzakta silinmiyor —\n" +
        "  kurumun gerçek öğrencileri olabilir. Bu şubeye dokunulmadı.",
    );
  }

  if (yazilabilir.length === 0) {
    throw new Error(
      "Yazılabilecek şube kalmadı: bütün şubelerde ad çakışması var.\n" +
        "Hiçbir şey yazılmadı. Deneme öğrencilerini arayüzden silip tekrar " +
        "çalıştırın.",
    );
  }

  return yazilabilir;
}

/** Bir şubenin öğrencilerini, kayıtlarını ve puanlamalarını üretir. */
async function subeVerisiUret(
  set: SubeSeti,
  donem: Parameters<typeof gruplariSagla>[1],
  kulup: Parameters<typeof gruplariSagla>[2],
) {
  console.log(`\n── ${set.ad} ──`);

  // Stajyer hesapları: varsa okunur, yoksa açılır.
  //
  // Önceden yalnızca okunuyor ve yoksa hata veriliyordu — çünkü hesapları
  // `seed.ts` açıyor. Ama seed deneme stajyerlerini BİLEREK yalnızca yerel
  // makinede açıyor (üretime hayalet hesap gitmesin diye), dolayısıyla bu
  // betik uzak bir veritabanında hiç çalışamıyordu. Artık kendi ihtiyacı olan
  // hesabı kendisi açıyor; bu betik zaten deneme verisi yazdığı için deneme
  // stajyeri açması da tutarlı.
  const stajyerler: Record<string, { id: string }> = {};
  for (const [anahtar, tanim] of Object.entries(set.stajyerler)) {
    let hesap = await db.user.findUnique({ where: { email: tanim.eposta } });

    if (!hesap) {
      hesap = await db.user.create({
        data: {
          email: tanim.eposta,
          name: tanim.ad,
          roles: ["STAJYER"],
          branchId: set.subeId,
          passwordHash: await hash(stajyerParolasi(), 12),
        },
      });
      acilanHesaplar.push(`${tanim.eposta} (${set.ad})`);
    } else if (hesap.branchId !== set.subeId) {
      // Var olan bir hesabın şubesini DEĞİŞTİRMİYORUZ: o hesabın diğer
      // şubede kayıtları ve puanlamaları olabilir, taşımak onları sahipsiz
      // bırakırdı. Karar kullanıcının.
      throw new Error(
        `${tanim.eposta} başka bir şubeye ait; örnek veri bu hesabı taşımaz. ` +
          `Kullanıcılar ekranından şubesini düzeltin ya da bu betiği ` +
          `çalıştırmadan önce hesabı silin.`,
      );
    }

    stajyerler[anahtar] = hesap;
  }

  const gruplar = await gruplariSagla(set, donem, kulup);

  // --- Ad çakışması: yerelde temizle, uzakta DOKUNMA ------------------------
  //
  // Betik tekrar çalıştırılabilir olsun diye kendi ürettiği öğrencileri silip
  // yeniden yazıyor. Eşleştirme ADA göre yapılıyor ve bu, uzak bir
  // veritabanında kabul edilemez: kurumun gerçek öğrencilerinden birinin adı
  // buradaki uydurma adlardan biriyle aynıysa o çocuğun kaydı, velileri,
  // puanlamaları ve raporları silinirdi. "Deneme verisi yükledim" diye
  // çalıştırılan bir komutun gerçek veri silmesi kabul edilebilir bir risk
  // değil.
  //
  // Bu yüzden silme yalnızca YEREL veritabanında yapılıyor. Uzakta çakışma
  // varsa betik hiçbir şey yazmadan duruyor ve kararı kullanıcıya bırakıyor.
  const cakisanlar = await db.student.findMany({
    where: {
      branchId: set.subeId,
      OR: set.ogrenciler.map((o) => ({ firstName: o.ad, lastName: o.soyad })),
    },
    select: { id: true, firstName: true, lastName: true },
  });

  // Uzakta buraya hiç gelinmiyor: çakışma varsa `cakismalariDenetle` daha
  // yazma başlamadan durduruyor.
  if (cakisanlar.length > 0 && yerelVeritabaniMi()) {
    const idler = cakisanlar.map((o) => o.id);
    // ReportPdf → Report bağı `Restrict`; önce PDF'ler, sonra raporlar.
    await db.reportPdf.deleteMany({
      where: { report: { studentId: { in: idler } } },
    });
    await db.report.deleteMany({ where: { studentId: { in: idler } } });
    await db.student.deleteMany({ where: { id: { in: idler } } });
    console.log(`· ${cakisanlar.length} eski örnek öğrenci silindi`);
  }

    // --- Öğrenciler, kayıtlar, puanlar ---------------------------------------
    let kayitSayisi = 0;
    let puanSayisi = 0;
    let cevapSayisi = 0;

    for (const tanim of set.ogrenciler) {
      const ogrenci = await db.student.create({
        data: {
          firstName: tanim.ad,
          lastName: tanim.soyad,
          birthDate: new Date(`${tanim.dogum}T00:00:00.000Z`),
          school: tanim.okul,
          grade: tanim.sinif,
          notes: tanim.notlar,
          searchName: normalizeArama(`${tanim.ad} ${tanim.soyad}`),
          branchId: set.subeId,
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
            internId: stajyerler[tanim.stajyer].id,
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
              scoredByUserId: stajyerler[tanim.stajyer].id,
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

  const doluluk = await Promise.all(
    Object.entries(gruplar).map(async ([anahtar, grup]) => {
      const sayi = await db.enrollment.count({
        where: { groupId: grup.id, status: "AKTIF" },
      });
      return `    ${anahtar.padEnd(17)} ${sayi}/${grup.capacity}`;
    }),
  );

  console.log(`✓ ${set.ogrenciler.length} öğrenci · ${kayitSayisi} kayıt`);
  console.log(`✓ ${puanSayisi} puanlama formu, ${cevapSayisi} cevap satırı`);
  console.log(`  Grup doluluğu:\n${doluluk.join("\n")}`);
}

async function main() {
  // Bu betik uydurma öğrenci ve puan yazıyor. Üretim veritabanında
  // çalıştırılması gerçek kayıtların arasına deneme verisi karıştırır ve geri
  // almak zordur; uzak veritabanında baştan reddediliyor.
  if (!yerelVeritabaniMi() && process.env.ORNEK_VERI_ONAY !== "evet") {
    console.error(
      "\nBu betik uydurma öğrenci verisi yazar ve öncelikle yerel veritabanı" +
        "\niçindir. DATABASE_URL yerel bir adrese işaret etmiyor." +
        "\n\nUzak veritabanında çalıştırılırsa:" +
        "\n  · eksik deneme stajyeri hesapları AÇILIR (parola sonunda basılır)," +
        "\n  · örnek veriyle aynı adlı öğrencisi olan ŞUBE ATLANIR" +
        "\n    (yereldeki gibi silmez — gerçek öğrenci olabilir)." +
        "\n\nGerçekten devam etmek istiyorsanız: ORNEK_VERI_ONAY=evet\n",
    );
    process.exit(1);
  }

  console.log("Örnek veri yükleniyor...");
  if (!yerelVeritabaniMi()) {
    console.log("· UZAK veritabanı — silme kapalı, çakışan şube atlanır.");
  }

  // Dönem ve kulüp ORTAK: iki şube de aynı programın içinde kendi gruplarını
  // açıyor. Bu yüzden bir kez bulunuyor, şube döngüsünün dışında.
  const donem = await db.term.findFirst({
    orderBy: { createdAt: "asc" },
    include: { weeks: { orderBy: { weekNumber: "asc" } }, workshops: true },
  });
  const kulup = await db.club.findFirst({
    orderBy: { createdAt: "asc" },
    include: { workshops: true },
  });

  if (!donem || donem.weeks.length === 0 || !kulup) {
    throw new Error(
      "Ortak dönem veya kulüp yok. Arayüzden bir dönem ve bir kulüp oluşturun.",
    );
  }

  const setler = yerelVeritabaniMi()
    ? SUBE_SETLERI
    : await yazilabilirSubeler(SUBE_SETLERI);

  for (const set of setler) {
    await subeVerisiUret(set, donem, kulup);
  }

  if (acilanHesaplar.length > 0) {
    console.log(`\n✓ ${acilanHesaplar.length} deneme stajyeri hesabı açıldı:`);
    for (const h of acilanHesaplar) console.log(`   · ${h}`);
    if (uretilenSifre) {
      console.log("\n" + "─".repeat(62));
      console.log("  Bu hesapların parolası (rastgele üretildi):");
      console.log("\n      %s\n", uretilenSifre);
      console.log("  Bir daha gösterilmeyecek. Şimdi kaydedin.");
      console.log("─".repeat(62));
    } else {
      console.log(`   parola: ${stajyerParolasi()}`);
    }
  }

  const toplamOgrenci = await db.student.count();
  console.log(`\n  Veritabanındaki toplam öğrenci: ${toplamOgrenci}`);
  console.log("\n  Denemeye değer profiller:");
  for (const set of SUBE_SETLERI) {
    for (const tanim of set.ogrenciler) {
      const p = PROFILLER[tanim.profil];
      if (
        ["azVeri", "gozlemlenemeyen", "devamsiz", "eksikFormlu", "puanlanmamis", "karma"].includes(
          tanim.profil,
        )
      ) {
        console.log(
          `    ${`${tanim.ad} ${tanim.soyad}`.padEnd(20)} ${p.ad.padEnd(24)} ${set.ad}`,
        );
      }
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
