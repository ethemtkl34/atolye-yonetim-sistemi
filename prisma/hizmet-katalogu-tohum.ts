/**
 * §17.2 — Hizmet kataloğunu mevcut bir veritabanına yazar.
 *
 *   DATABASE_URL="…" npx tsx prisma/hizmet-katalogu-tohum.ts
 *
 * `seed.ts` bunu zaten yapıyor ama seed taze kurulum içindir: şubeleri,
 * hesapları ve atölye çeşitlerini de yazar. Katalog sonradan (randevu modülü
 * eklendiğinde) geldiği için ÇALIŞAN bir veritabanına yalnız katalogu
 * eklemenin yolu gerekti — kurumun düzenlemiş olabileceği atölye adlarına ve
 * hesaplarına dokunmadan.
 *
 * Tekrar tekrar çalıştırılabilir:
 *  - Katalogda olmayan hizmeti EKLER.
 *  - Var olanın yalnız grubunu ve sırasını tazeler.
 *  - FİYAT VE SÜREYE DOKUNMAZ. Kurum panelden zam yaptıktan sonra bu betiğin
 *    yeniden çalışması onu geri almamalı (seed'deki parola kuralıyla aynı
 *    gerekçe).
 *  - Katalogdan silinmiş hizmeti geri getirmez; silme kurumun kararıdır.
 *
 * Fiyatı veya süreyi buradan güncellemek gerekiyorsa `--fiyatlari-da-yaz`
 * bayrağı kullanılır; bu bilinçli bir üzerine yazma işlemidir.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { HIZMETLER } from "./hizmet-katalogu";

// Prisma 7'de bağlantı driver adapter üzerinden kurulur (bkz. src/lib/db.ts).
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const fiyatlariDaYaz = process.argv.includes("--fiyatlari-da-yaz");

async function main() {
  const oncekiSayi = await db.hizmet.count();

  let eklenen = 0;
  let guncellenen = 0;

  for (const [sira, hizmet] of HIZMETLER.entries()) {
    const { ad, grup, danisanTuru, tekrarli, ...kalan } = hizmet;

    const mevcut = await db.hizmet.findUnique({
      where: { ad },
      select: { id: true },
    });

    if (mevcut) {
      await db.hizmet.update({
        where: { id: mevcut.id },
        data: fiyatlariDaYaz
          ? {
              grup,
              sortOrder: sira,
              danisanTuru: danisanTuru ?? "COCUK",
              tekrarli: tekrarli ?? false,
              ...kalan,
            }
          : { grup, sortOrder: sira },
      });
      guncellenen += 1;
      continue;
    }

    await db.hizmet.create({
      data: {
        ad,
        grup,
        danisanTuru: danisanTuru ?? "COCUK",
        tekrarli: tekrarli ?? false,
        sortOrder: sira,
        ...kalan,
      },
    });
    eklenen += 1;
  }

  const sonSayi = await db.hizmet.count();

  console.log(`Katalog: ${oncekiSayi} → ${sonSayi} hizmet`);
  console.log(`  eklenen      : ${eklenen}`);
  console.log(
    `  güncellenen  : ${guncellenen}` +
      (fiyatlariDaYaz ? " (fiyat ve süre dahil)" : " (yalnız grup ve sıra)"),
  );

  const tablo = await db.hizmet.findMany({
    orderBy: { sortOrder: "asc" },
    select: { ad: true, grup: true, sureDk: true, ucretKurus: true },
  });
  for (const satir of tablo) {
    const ucret = (satir.ucretKurus / 100).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
    });
    console.log(
      `  ${satir.ad.padEnd(28)} ${String(satir.sureDk).padStart(3)} dk  ₺${ucret}`,
    );
  }
}

main()
  .catch((hata) => {
    console.error("Katalog yazılamadı:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
