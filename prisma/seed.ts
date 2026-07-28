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
 * Geliştirme hesapları. Üretime alırken (P12) bu hesaplar silinip kurumun
 * gerçek kullanıcıları oluşturulacak.
 */
const GELISTIRME_SIFRESI = "Atolye2026!";

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

  const passwordHash = await hash(GELISTIRME_SIFRESI, 12);

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

  console.log(
    `\nGeliştirme girişi:\n  ${KULLANICILAR[0].email} / ${GELISTIRME_SIFRESI}`,
  );
}

main()
  .catch((hata) => {
    console.error("Başlangıç verisi yüklenemedi:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
