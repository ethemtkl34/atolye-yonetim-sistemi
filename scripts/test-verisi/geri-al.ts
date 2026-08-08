/**
 * `uret.ts` ve `mufredat-uret.ts` ile yazılan deneme verisini geri alır.
 *
 *   ONAY=EVET npx tsx --env-file=.env.local scripts/test-verisi/geri-al.ts
 *
 * Yalnızca `manifest.json` içindeki kimliklere dokunur; kimliksiz hiçbir
 * satır silinmez. Gözlem notları silinmez, `null`a çekilir — alan kaydın
 * kendisine ait, satırı silmek kaydı da götürürdü.
 *
 * Manifest neden tek doğruluk kaynağı: `ScoreAnswer` tablosunda zaman damgası
 * yok, "bu satırı ne zaman kim yazdı" sorusunun veriden cevabı yok. Kimlik
 * listesi olmadan ayıklama, "aktif soruya ait bütün cevaplar" gibi geniş ve
 * gerçek veriyi de kapsayan bir yüklemle yapılmak zorunda kalırdı.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MANIFEST_YOLU = join(import.meta.dirname, "manifest.json");

type GozlemKaydi = { id: string; oncekiDeger: string | null };

type Manifest = {
  olusturmaZamani: string;
  scoreAnswerIdleri: string[];
  gelisimDegerlendirmeIdleri: string[];
  kayitGozlemleri: GozlemKaydi[];
  puanlamaGozlemleri: GozlemKaydi[];
  mufredatIdleri: string[];
  atolyeIcerikIdleri: string[];
  /** `rapor-dogrula.ts` ile üretilen doğrulama raporları. */
  raporIdleri?: string[];
};

async function main() {
  const manifest = JSON.parse(
    readFileSync(MANIFEST_YOLU, "utf8"),
  ) as Manifest;

  const ozet = [
    `${manifest.scoreAnswerIdleri.length} cevap satırı silinecek`,
    `${manifest.gelisimDegerlendirmeIdleri.length} gelişim değerlendirmesi silinecek`,
    `${manifest.kayitGozlemleri.length} kayıt gözlem notu eski hâline dönecek`,
    `${manifest.puanlamaGozlemleri.length} oturum gözlem notu eski hâline dönecek`,
    `${manifest.mufredatIdleri.length} müfredat satırı silinecek`,
    `${manifest.atolyeIcerikIdleri.length} atölye içerik metni silinecek`,
    `${manifest.raporIdleri?.length ?? 0} doğrulama raporu silinecek`,
  ];

  if (process.env.ONAY !== "EVET") {
    console.error(
      `\n${manifest.olusturmaZamani} tarihli deneme verisi geri alınacak:\n` +
        ozet.map((s) => `  - ${s}`).join("\n") +
        `\n\nDevam etmek için:\n  ONAY=EVET npx tsx --env-file=.env.local scripts/test-verisi/geri-al.ts\n`,
    );
    process.exit(1);
  }

  await db.$transaction(async (tx) => {
    // Rapor önce: `ReportPdf → Report` bağı Restrict, PDF kaydedilmiş bir
    // rapor silinemez. Doğrulama raporlarının PDF'i veritabanına yazılmadı,
    // yine de sıra `temizlik.ts` ile aynı ilkeyi izliyor.
    await tx.report.deleteMany({
      where: { id: { in: manifest.raporIdleri ?? [] } },
    });
    await tx.scoreAnswer.deleteMany({
      where: { id: { in: manifest.scoreAnswerIdleri } },
    });
    await tx.developmentAssessment.deleteMany({
      where: { id: { in: manifest.gelisimDegerlendirmeIdleri } },
    });
    // Notlar tek tek yazılır: her satırın kendi eski değeri var, toplu
    // `updateMany` hepsine aynı değeri koyardı.
    for (const kayit of manifest.kayitGozlemleri) {
      await tx.enrollment.update({
        where: { id: kayit.id },
        data: { gozlemNotu: kayit.oncekiDeger },
      });
    }
    for (const kayit of manifest.puanlamaGozlemleri) {
      await tx.score.update({
        where: { id: kayit.id },
        data: { gozlemNotu: kayit.oncekiDeger },
      });
    }
    await tx.atolyeIcerigi.deleteMany({
      where: { id: { in: manifest.atolyeIcerikIdleri } },
    });
    await tx.curriculumEntry.deleteMany({
      where: { id: { in: manifest.mufredatIdleri } },
    });
  });

  console.log("Geri alındı:");
  for (const satir of ozet) console.log(`  - ${satir.replace("ecek", "di")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
