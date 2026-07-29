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

/** §2.1 — Başlangıç atölye envanteri. */
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
];

/**
 * §9.3 — Başlangıçta bütün atölyelere aynı örnek soru seti atanır.
 * Sonrasında her atölyenin seti bağımsız olarak düzenlenebilir.
 */
const BASLANGIC_SORULARI = [
  "Atölye ve etkinliklere ilgi gösterir.",
  "Atölye ve etkinliklere katılım sağlar ve etkileşim kurar.",
  "Yeni şeyler öğrenmeye yönelik merak ve keşif isteği gösterir.",
  "Atölye veya etkinlik sırasında sorulan sorulara cevap verir.",
  "İnce motor becerilerini etkin şekilde kullanır.",
  "Özgün tasarımlar oluşturabilir.",
  "Zamanı doğru ve etkin kullanır.",
  "Oran-orantı, uyum ve ahenk ilişkisine dikkat eder.",
  "Çalışmalarını özenle ve estetik duyarlılıkla gerçekleştirir.",
  "Etkinliğe sebatla devam eder ve çalışmasını tamamlar.",
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

const KULLANICILAR = [
  {
    email: "koordinator@tuzder.local",
    name: "Kurum Koordinatörü",
    role: "KOORDINATOR" as const,
  },
  {
    email: "ayse@tuzder.local",
    name: "Ayşe Yılmaz",
    role: "STAJYER" as const,
  },
  {
    email: "mehmet@tuzder.local",
    name: "Mehmet Kaya",
    role: "STAJYER" as const,
  },
];

async function main() {
  console.log("Başlangıç verisi yükleniyor...\n");

  const { sifre, kaynak } = parolaBelirle();
  const passwordHash = await hash(sifre, 12);

  for (const kullanici of KULLANICILAR) {
    await db.user.upsert({
      where: { email: kullanici.email },
      // Şifreyi güncellemiyoruz: seed tekrar çalıştığında kurumun değiştirdiği
      // şifre sıfırlanmasın.
      update: { name: kullanici.name, role: kullanici.role },
      create: { ...kullanici, passwordHash },
    });
  }
  console.log(`✓ ${KULLANICILAR.length} kullanıcı hesabı`);

  let toplamSoru = 0;

  for (const [sira, atolye] of ATOLYELER.entries()) {
    const kayit = await db.workshopType.upsert({
      where: { name: atolye.name },
      update: { description: atolye.description, sortOrder: sira },
      create: { ...atolye, sortOrder: sira },
    });

    // Sorular yalnızca atölyenin hiç sorusu yoksa eklenir. Kurum soruları
    // düzenledikten sonra seed tekrar çalıştırılırsa silinenler geri gelmemeli.
    const mevcutSoruSayisi = await db.question.count({
      where: { workshopTypeId: kayit.id },
    });

    if (mevcutSoruSayisi === 0) {
      await db.question.createMany({
        data: BASLANGIC_SORULARI.map((text, i) => ({
          workshopTypeId: kayit.id,
          text,
          sortOrder: i,
        })),
      });
      toplamSoru += BASLANGIC_SORULARI.length;
    }
  }

  console.log(`✓ ${ATOLYELER.length} atölye çeşidi`);
  console.log(
    toplamSoru > 0
      ? `✓ ${toplamSoru} değerlendirme sorusu`
      : "· Sorular zaten mevcut, dokunulmadı",
  );

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
