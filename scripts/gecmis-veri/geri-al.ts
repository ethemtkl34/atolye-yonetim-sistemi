/**
 * `aktar.ts` ile yazılan geçmiş veriyi geri alır.
 *
 *   ONAY=EVET npx tsx --env-file=.env.local scripts/gecmis-veri/geri-al.ts
 *
 * Yalnızca `cikti/manifest.json` içindeki kimliklere dokunur; kimliksiz
 * hiçbir satır silinmez. Böylece aktarımdan SONRA panelden elle eklenmiş
 * kayıtlar (yeni bir kayıt, bir veli görüşmesi) hayatta kalır.
 *
 * Silme sırası yabancı anahtarları takip eder: rapor → kayıt → öğrenci →
 * grup → dönem/kulüp. Bir öğrenciye aktarımdan sonra veri eklendiyse
 * (görüşme, zeka testi) cascade onu da götürür; bu yüzden silmeden önce
 * böyle öğrenciler sayılıp uyarı basılır.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MANIFEST_YOLU = join(import.meta.dirname, "cikti", "manifest.json");

type Manifest = {
  olusturmaZamani: string;
  termIdleri: string[];
  clubIdleri: string[];
  groupIdleri: string[];
  studentIdleri: string[];
  enrollmentIdleri: string[];
  legacyReportIdleri: string[];
};

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_YOLU, "utf8")) as Manifest;

  const dokunulmus = await db.student.count({
    where: {
      id: { in: manifest.studentIdleri },
      OR: [
        { counselingSessions: { some: {} } },
        { parentMeetings: { some: {} } },
        { intelligenceTests: { some: {} } },
        { reports: { some: {} } },
      ],
    },
  });

  console.log(`Manifest    : ${manifest.olusturmaZamani}`);
  console.log(`Arşiv raporu: ${manifest.legacyReportIdleri.length}`);
  console.log(`Kayıt       : ${manifest.enrollmentIdleri.length}`);
  console.log(`Öğrenci     : ${manifest.studentIdleri.length}`);
  console.log(`Grup        : ${manifest.groupIdleri.length}`);
  console.log(`Dönem/Kulüp : ${manifest.termIdleri.length} / ${manifest.clubIdleri.length}`);
  if (dokunulmus > 0) {
    console.log(
      `\n⚠  ${dokunulmus} öğrenciye aktarımdan sonra veri eklenmiş ` +
        "(görüşme, zeka testi veya rapor). Silinirse onlar da gider.",
    );
  }

  if (process.env.ONAY !== "EVET") {
    console.log("\nSilme yapılmadı. Onaylamak için: ONAY=EVET ile yeniden çalıştırın.");
    return;
  }

  await db.legacyReport.deleteMany({ where: { id: { in: manifest.legacyReportIdleri } } });
  await db.enrollment.deleteMany({ where: { id: { in: manifest.enrollmentIdleri } } });
  await db.student.deleteMany({ where: { id: { in: manifest.studentIdleri } } });
  await db.group.deleteMany({ where: { id: { in: manifest.groupIdleri } } });
  await db.term.deleteMany({ where: { id: { in: manifest.termIdleri } } });
  await db.club.deleteMany({ where: { id: { in: manifest.clubIdleri } } });

  console.log("\nGeçmiş veri geri alındı.");
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
