/**
 * AppSheet randevu aktarımını geri alır.
 *
 *   DATABASE_URL="…" APPSHEET_ONAY=evet npx tsx scripts/appsheet-randevu/geri-al.ts cikti/manifest-<zaman>.json
 *
 * Sıra yabancı anahtarların gerektirdiği gibi: önce `disKaynakId`si
 * "appsheet:" ile başlayan randevular, sonra manifestteki öğrenci, veli ve
 * uzmanlar. Aktarımdan SONRA başka bir kayda bağlanmış olan (panelden randevu
 * açılmış, kayıt yapılmış, veli bağı kurulmuş) öğrenci/veli/uzman SİLİNMEZ ve
 * sayısı bildirilir — geri alma, aktarımdan sonra girilen işi götürmemeli.
 */
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const MANIFEST = process.argv[2];
if (!MANIFEST) throw new Error("Manifest yolu verilmeli.");
if (process.env.APPSHEET_ONAY !== "evet") throw new Error("APPSHEET_ONAY=evet gerekli.");

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
  kaynakOneki: string;
  uzmanlar: string[];
  veliler: string[];
  ogrenciler: string[];
};

async function main() {
  const sonuc = await db.$transaction(
    async (tx) => {
      const randevu = await tx.randevu.deleteMany({
        where: { disKaynakId: { startsWith: manifest.kaynakOneki } },
      });

      const ogrenci = await tx.student.deleteMany({
        where: {
          id: { in: manifest.ogrenciler },
          randevular: { none: {} },
          enrollments: { none: {} },
          guardians: { none: {} },
          counselingSessions: { none: {} },
          parentMeetings: { none: {} },
          intelligenceTests: { none: {} },
          reports: { none: {} },
          legacyReports: { none: {} },
        },
      });

      const veli = await tx.veli.deleteMany({
        where: {
          id: { in: manifest.veliler },
          randevular: { none: {} },
          guardians: { none: {} },
        },
      });

      // Uzmanın şube/hizmet bağları Cascade ile gidiyor.
      const uzman = await tx.uzman.deleteMany({
        where: { id: { in: manifest.uzmanlar }, randevular: { none: {} } },
      });

      return {
        randevu: randevu.count,
        ogrenci: `${ogrenci.count} / ${manifest.ogrenciler.length}`,
        veli: `${veli.count} / ${manifest.veliler.length}`,
        uzman: `${uzman.count} / ${manifest.uzmanlar.length}`,
      };
    },
    { timeout: 10 * 60_000, maxWait: 60_000 },
  );
  console.log("GERİ ALINDI (silinen / manifestteki):", sonuc);
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
