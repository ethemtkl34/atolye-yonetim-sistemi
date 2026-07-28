import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * Prisma istemcisi tek örnek (singleton) olarak tutulur.
 *
 * Geliştirmede Next.js her dosya değişikliğinde modülleri yeniden yüklüyor;
 * önlem alınmazsa her yeniden yüklemede yeni bir bağlantı havuzu açılır ve
 * veritabanı kısa sürede bağlantı sınırına dayanır. Global nesneye tutunmak
 * bunu engeller. Üretimde modül zaten bir kez yükleniyor.
 *
 * Prisma 7'de bağlantı bir driver adapter üzerinden kurulur; `DATABASE_URL`
 * istemciye kendiliğinden geçmez, buradan açıkça verilir.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function istemciOlustur() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? istemciOlustur();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
