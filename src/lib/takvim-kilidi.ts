import type { Prisma } from "@/generated/prisma/client";

/**
 * Grubun takvim/puanlama yazmalarını sıraya alan transaction advisory lock'u.
 *
 * NEDEN: "puanlanmış gün silinemez" kontrolü (takvim-eylemleri) ile puan
 * kaydetme (stajyer/puanlama/actions) aynı `Session` satırları üzerinde
 * yarışır. Kontrol ile silme arasına bir puan kaydı girerse `Score` cascade
 * ile sessizce giderdi; tersine, silinmiş bir oturuma puan yazmak da ham
 * FK hatası üretirdi. İki taraf da yazmadan önce bu kilidi aldığı için iki
 * senaryo da kapanır. Kilit gruba bağlıdır: farklı gruplar birbirini
 * bekletmez ("kayit:"+groupId deseninin aynısı).
 */
export async function takvimKilidiAl(
  tx: Prisma.TransactionClient,
  grupId: string,
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${"takvim:" + grupId}))::text
      AS "kilit"
  `;
}
