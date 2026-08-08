/** Kaydedilmiş bir rapor PDF'ini yerelde basar (görsel doğrulama için). */
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { renderToBuffer } from "@react-pdf/renderer";
import { RaporBelgesiV2 } from "../src/lib/pdf/rapor-belgesi-v2";
import type { RaporGovdesiV2 } from "../src/lib/rapor-govdesi";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rapor = await db.report.findFirst({
    where: { student: { firstName: process.argv[3] ?? undefined } },
    orderBy: { generatedAt: "desc" },
    select: { bodyJson: true, generatedAt: true },
  });
  if (!rapor) throw new Error("Rapor yok");

  const belge = await renderToBuffer(
    RaporBelgesiV2({
      govde: rapor.bodyJson as unknown as RaporGovdesiV2,
      uretimZamani: rapor.generatedAt,
    }),
  );
  const yol = process.argv[2] ?? "rapor-onizleme.pdf";
  writeFileSync(yol, belge);
  console.log("yazıldı:", yol, belge.length, "bayt");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
