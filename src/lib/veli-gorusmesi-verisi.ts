import { db } from "./db";
import { raporGirdisiHazirla } from "./rapor-verisi";
import type { RaporGirdisi } from "./report-engine";

/**
 * Veli görüşmesi brief'inin veri katmanı.
 *
 * Motor saf ve veritabanı bilmiyor (`veli-gorusmesi.ts`); bu dosya ona girdiyi
 * hazırlıyor. Rapordan farkı: kapsam SEÇİLMEZ — brief öğrencinin BÜTÜN
 * kayıtlarını, görüşme tarihine kadarki oturumlarıyla özetler. Veli "nasıl
 * gidiyor" diye geliyor; hangi kaydın kapsama gireceğini seçtirmek görüşme
 * hazırlığını rapor üretimine çevirirdi.
 *
 * ŞUBE: her sorgu `subeId` zorunlu alır; başka şubenin öğrenci id'si
 * yapıştırılırsa sorgu boş döner.
 */
export async function veliBriefGirdisiHazirla(
  ogrenciId: string,
  subeId: string,
  gorusmeTarihi: Date,
): Promise<RaporGirdisi | null> {
  const kayitlar = await db.enrollment.findMany({
    where: { studentId: ogrenciId, group: { branchId: subeId } },
    select: { id: true },
  });

  return raporGirdisiHazirla(
    ogrenciId,
    kayitlar.map((kayit) => kayit.id),
    subeId,
    { enGecTarih: gorusmeTarihi },
  );
}
