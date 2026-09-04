/**
 * Başlangıç verisi.
 *
 * `npm run db:seed` ile çalışır ve tekrar tekrar çalıştırılabilir (idempotent):
 * var olan kayıtları günceller, kopya oluşturmaz.
 *
 * Buradaki atölyeler ve sorular docs/PROJECT_SPEC.md §2.1 ve §9.3'ten gelir.
 * §9.3'ün son cümlesi açık: "Bu sorular başlangıç verisidir; sabit ve
 * değiştirilemez kabul edilmemelidir." Kurum kurulumdan sonra her atölyenin
 * sorularını arayüzden bağımsız olarak düzenleyebilir.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Prisma 7'de veritabanı bağlantısı bir driver adapter üzerinden kurulur;
// `DATABASE_URL` artık istemciye kendiliğinden geçmiyor.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * §2.1 — Başlangıç atölye envanteri.
 *
 * Adlar `soru_kategorileri` migration'ındaki kanonik adlarla aynı; sorular
 * artık seed'den değil o migration'dan gelir (taze kurulumda migration'lar
 * seed'den önce oynatıldığı için soru seti hazır olur). Seed yalnızca
 * atölyenin adını/açıklamasını günceller.
 */
const ATOLYELER = [
  {
    name: "Bilim Atölyesi",
    description: "Deney ve gözlem temelli bilim etkinlikleri.",
  },
  {
    name: "Robotik ve Kodlama Atölyesi",
    description: "Algoritma kurma, kodlama ve robotik uygulamaları.",
  },
  {
    name: "Astronomi Atölyesi",
    description: "Gök cisimleri, gözlem ve uzay bilimleri etkinlikleri.",
  },
  {
    name: "Zekâ ve Akıl Oyunları Atölyesi",
    description: "Strateji, mantık ve problem çözme oyunları.",
  },
  {
    name: "Hayal Tasarım Atölyesi",
    description: "Yaratıcı tasarım ve el becerisi çalışmaları.",
  },
  {
    name: "Sosyal Duygusal Beceriler Atölyesi (Drama)",
    description: "Drama yoluyla duygu tanıma, ifade ve iş birliği çalışmaları.",
  },
  {
    name: "STEM Maker Atölyesi",
    description: "Elektronik devreler ve maker uygulamaları.",
  },
  {
    name: "Masal ve Hikâye Atölyesi",
    description: "Masal ve hikâye temelli yaratıcı etkinlikler.",
  },
  {
    name: "Düşünme Becerileri Atölyesi",
    description: "Kritik ve yaratıcı düşünme çalışmaları.",
  },
  {
    name: "Gastronomi Atölyesi",
    description: "Mutfak kültürü ve uygulamalı mutfak etkinlikleri.",
  },
  {
    name: "Ahşap Modelleme Atölyesi",
    description: "Ahşapla tasarım ve modelleme çalışmaları.",
  },
];

/**
 * Başlangıç hesaplarının parolası.
 *
 * Depo herkese açık olduğu için buradaki sabit parola yalnızca YEREL
 * veritabanında kullanılabilir. Uzak bir veritabanına seed çalıştırılırsa
 * (üretim) sabit parola kullanılmaz: `SEED_PASSWORD` verilmişse o, verilmemişse
 * rastgele üretilen bir parola yazılır ve ekrana bir kez basılır.
 *
 * Aksi hâlde üretimdeki koordinatör hesabı, GitHub'dan okunabilen bir parolayla
 * açılmış olurdu.
 */
const YEREL_SIFRE = "Atolye2026!";

function yerelVeritabaniMi(): boolean {
  const adres = process.env.DATABASE_URL ?? "";
  return adres.includes("localhost") || adres.includes("127.0.0.1");
}

function parolaBelirle(): { sifre: string; kaynak: string } {
  if (process.env.SEED_PASSWORD) {
    return { sifre: process.env.SEED_PASSWORD, kaynak: "SEED_PASSWORD" };
  }
  if (yerelVeritabaniMi()) {
    return { sifre: YEREL_SIFRE, kaynak: "yerel geliştirme parolası" };
  }
  // randomBytes: rastgeleliği tahmin edilebilir olmayan kaynaktan al.
  const uretilen = randomBytes(18).toString("base64url");
  return { sifre: uretilen, kaynak: "rastgele üretildi" };
}

/**
 * Şubeler. Kimlikler migration'daki INSERT ile aynı ve bilerek sabit:
 * migration onları backfill için kullanıyor, seed de aynı satırlara
 * tutunabilsin diye. `code` değişmez, `name` kurum isterse değişir.
 */
const SUBELER = [
  { id: "sube_umraniye", code: "umraniye", name: "Ümraniye Tüzder", sortOrder: 0 },
  { id: "sube_gunesli", code: "gunesli", name: "Güneşli Tüzder", sortOrder: 1 },
];

/**
 * Kurulum hesapları: bir yönetici ve her şubeye bir koordinatör.
 *
 * `branchId` null olan tek rol ADMIN'dir; veritabanındaki
 * `User_admin_sube_kurali` CHECK'i bunu ayrıca zorluyor.
 */
const KULLANICILAR = [
  {
    email: "yonetici@tuzder.local",
    name: "Kurum Yöneticisi",
    roles: ["ADMIN" as const],
    branchId: null,
  },
  {
    email: "umraniye@tuzder.local",
    name: "Ümraniye Koordinatörü",
    roles: ["KOORDINATOR" as const],
    branchId: "sube_umraniye",
  },
  {
    email: "gunesli@tuzder.local",
    name: "Güneşli Koordinatörü",
    roles: ["KOORDINATOR" as const],
    branchId: "sube_gunesli",
  },
];

/**
 * Yalnızca geliştirme makinesinde açılan deneme stajyerleri.
 *
 * Önceden bunlar üretime de gidiyordu; şubeli yapıda bu, kimsenin istemediği
 * iki hayalet Ümraniye stajyeri demek olurdu. Gerçek stajyer hesaplarını
 * kurum kendi açar.
 */
const YEREL_STAJYERLER = [
  {
    email: "ayse@tuzder.local",
    name: "Ayşe Yılmaz",
    roles: ["STAJYER" as const],
    branchId: "sube_umraniye",
  },
  {
    email: "mehmet@tuzder.local",
    name: "Mehmet Kaya",
    roles: ["STAJYER" as const],
    branchId: "sube_umraniye",
  },
  {
    email: "zeynep@tuzder.local",
    name: "Zeynep Demir",
    roles: ["STAJYER" as const],
    branchId: "sube_umraniye",
  },
  // Güneşli stajyerleri — şube izolasyonunun denenebilmesi için bu şubede de
  // birden fazla stajyer var (atama ekranı tek stajyerle gerçekçi görünmüyor).
  {
    email: "elif@tuzder.local",
    name: "Elif Şahin",
    roles: ["STAJYER" as const],
    branchId: "sube_gunesli",
  },
  {
    email: "burak@tuzder.local",
    name: "Burak Yıldırım",
    roles: ["STAJYER" as const],
    branchId: "sube_gunesli",
  },
  {
    email: "selin@tuzder.local",
    name: "Selin Aktaş",
    roles: ["STAJYER" as const],
    branchId: "sube_gunesli",
  },
];


/**
 * §17.2 — Hizmet kataloğu başlangıç verisi.
 *
 * Fiyatlar ve süreler kurumun 2026 fiyat listesinden. Ücret KURUŞ cinsinden
 * tamsayı: ₺3.200,00 = 320000.
 *
 * Liste iki kaynağın birleşimidir:
 *  - Kurumun güncel fiyat listesi (dört zekâ testi + altı danışmanlık).
 *  - Mevcut `TherapyType` enum'ının değerleri. "Ergoterapi" fiyat listesinde
 *    yok ama canlıda ona bağlı görüşme kayıtları var; katalogda karşılığı
 *    olmasaydı o kayıtların hizmeti adsız kalırdı. Fiyat listesindeki
 *    karşılığı olan "Duyu Bütünleme Programı" ile AYNI ŞEY OLUP OLMADIĞI
 *    kuruma soruldu ve ayrı hizmet oldukları teyit edilmedi — ikisi de
 *    katalogda duruyor, kurum gerekmeyeni panelden pasife alabilir.
 *
 * Katalog buradan sonra PANELDEN yönetilir; seed yalnızca adı, grubu ve
 * sırayı tazeler. Fiyat ve süre `update` kapsamında DEĞİL: kurum panelden
 * zam yaptıktan sonra seed'in tekrar çalışması onu geri almamalı.
 */
const HIZMETLER: {
  ad: string;
  grup: "TEST" | "DANISMANLIK" | "ATOLYE";
  sureDk: number;
  ucretKurus: number;
  yasAlt?: number;
  yasUst?: number;
  tekrarli?: boolean;
  danisanTuru?: "COCUK" | "VELI";
}[] = [
  // Zekâ testleri — tek seferlik, otomatik tekrar kapsamı dışında.
  { ad: "WISC-IV", grup: "TEST", sureDk: 120, ucretKurus: 780000, yasAlt: 6, yasUst: 16 },
  { ad: "CAS", grup: "TEST", sureDk: 120, ucretKurus: 780000, yasAlt: 5, yasUst: 17 },
  { ad: "ST. Binet", grup: "TEST", sureDk: 120, ucretKurus: 780000, yasAlt: 2, yasUst: 5 },
  { ad: "Denver", grup: "TEST", sureDk: 90, ucretKurus: 680000, yasAlt: 0, yasUst: 3 },

  // Danışmanlıklar — haftalık tekrara açık.
  { ad: "Oyun Temelli Danışmanlık", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 74, tekrarli: true },
  { ad: "Ergen Danışmanlığı", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 74, tekrarli: true },
  { ad: "Bilişsel Müdahale", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 74, tekrarli: true },
  { ad: "Duyu Bütünleme Programı", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 18, tekrarli: true },
  { ad: "Ergoterapi", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 18, tekrarli: true },
  // Aile danışmanlığında danışan velinin KENDİSİ; seansa çocuk girmiyor.
  { ad: "Kısa Aile Danışmanlığı", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 17, tekrarli: true, danisanTuru: "VELI" },
  { ad: "Uzun Aile Danışmanlığı", grup: "DANISMANLIK", sureDk: 90, ucretKurus: 320000, yasAlt: 0, yasUst: 17, tekrarli: true, danisanTuru: "VELI" },

  // Atölye görüşmesi — ücretsiz.
  { ad: "Atölye Görüşmesi", grup: "ATOLYE", sureDk: 30, ucretKurus: 0, danisanTuru: "VELI" },
];

async function main() {
  console.log("Başlangıç verisi yükleniyor...\n");

  for (const sube of SUBELER) {
    await db.branch.upsert({
      where: { code: sube.code },
      update: { name: sube.name, sortOrder: sube.sortOrder },
      create: sube,
    });
  }
  console.log(`✓ ${SUBELER.length} şube`);

  const { sifre, kaynak } = parolaBelirle();
  const passwordHash = await hash(sifre, 12);

  const acilacakHesaplar = yerelVeritabaniMi()
    ? [...KULLANICILAR, ...YEREL_STAJYERLER]
    : KULLANICILAR;

  for (const kullanici of acilacakHesaplar) {
    await db.user.upsert({
      where: { email: kullanici.email },
      // Şifreyi güncellemiyoruz: seed tekrar çalıştığında kurumun değiştirdiği
      // şifre sıfırlanmasın. Şube ve rol ise güncelleniyor — biri değişmişse
      // seed'in tekrar çalışması onu düzeltmeli.
      update: {
        name: kullanici.name,
        roles: kullanici.roles,
        branchId: kullanici.branchId,
      },
      create: { ...kullanici, passwordHash },
    });
  }
  console.log(`✓ ${acilacakHesaplar.length} kullanıcı hesabı`);

  for (const [sira, atolye] of ATOLYELER.entries()) {
    await db.workshopType.upsert({
      where: { name: atolye.name },
      update: { description: atolye.description, sortOrder: sira },
      create: { ...atolye, sortOrder: sira },
    });
  }

  console.log(`✓ ${ATOLYELER.length} atölye çeşidi`);

  for (const [sira, hizmet] of HIZMETLER.entries()) {
    const { ad, grup, danisanTuru, tekrarli, ...kalan } = hizmet;
    await db.hizmet.upsert({
      where: { ad },
      // Fiyat ve süre BİLEREK güncellenmiyor: panelden yapılan zam seed'in
      // tekrar çalışmasıyla geri alınmamalı (kullanıcı parolasıyla aynı
      // gerekçe). Yeni bir hizmet eklenirse `create` dalı onu yazar.
      update: { grup, sortOrder: sira },
      create: {
        ad,
        grup,
        danisanTuru: danisanTuru ?? "COCUK",
        tekrarli: tekrarli ?? false,
        sortOrder: sira,
        ...kalan,
      },
    });
  }
  console.log(`✓ ${HIZMETLER.length} hizmet (katalog)`);
  console.log("· Değerlendirme soruları soru_kategorileri migration'ından gelir");

  if (yerelVeritabaniMi() && !process.env.SEED_PASSWORD) {
    console.log(`\nGeliştirme girişi:\n  ${KULLANICILAR[0].email} / ${sifre}`);
  } else {
    console.log("\n" + "─".repeat(62));
    console.log("  Başlangıç hesaplarının parolası (%s):", kaynak);
    console.log("\n      %s\n", sifre);
    console.log("  Bu parola bir daha gösterilmeyecek. Şimdi kaydedin ve ilk");
    console.log("  girişten sonra kurumun kendi hesaplarını oluşturun.");
    console.log("─".repeat(62));
  }
}

main()
  .catch((hata) => {
    console.error("Başlangıç verisi yüklenemedi:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
