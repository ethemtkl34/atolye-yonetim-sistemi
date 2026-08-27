/**
 * `uret.ts`'in yazdığı örnek adayları siler.
 *
 * YALNIZCA `manifest.json`daki kimlikleri siler; gerçek adaylara dokunmaz.
 * Etkinlikler `onDelete: Cascade` ile birlikte gider. Manifest yoksa hiçbir
 * şey silinmez — "hepsini temizle" gibi bir yolu bilerek yok.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const yol = join(import.meta.dirname, "manifest.json");
  let adayIds: string[];
  try {
    adayIds = JSON.parse(readFileSync(yol, "utf8")).adayIds ?? [];
  } catch {
    console.error("manifest.json okunamadı — silinecek bir şey yok.");
    process.exit(1);
  }

  if (adayIds.length === 0) {
    console.log("Manifestte kimlik yok.");
    await db.$disconnect();
    return;
  }

  // Güvenlik ağı: manifest yanlışlıkla gerçek bir adayın kimliğini taşısa bile
  // "(örnek)" işareti olmayan satır silinmez.
  const hedefler = await db.lead.findMany({
    where: { id: { in: adayIds }, parentName: { contains: "(örnek)" } },
    select: { id: true, parentName: true },
  });

  const sonuc = await db.lead.deleteMany({
    where: { id: { in: hedefler.map((h) => h.id) } },
  });

  console.log(`Silinen örnek aday: ${sonuc.count}`);
  const atlanan = adayIds.length - hedefler.length;
  if (atlanan > 0) {
    console.log(`Atlanan (işareti olmayan ya da zaten silinmiş): ${atlanan}`);
  }
  await db.$disconnect();
}

main().catch((hata) => {
  console.error(hata);
  process.exit(1);
});
