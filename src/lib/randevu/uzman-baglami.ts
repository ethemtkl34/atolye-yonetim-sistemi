import { db } from "@/lib/db";

/** DB okuyan çakışma bağlamı; karar `cakisma.ts` içinde saf kalır. */
export async function uzmanBaglami(args: { uzmanId: string; subeId: string; ilk: Date; son: Date; haricId?: string }) {
  const { uzmanId, subeId, ilk, son, haricId } = args;
  const [mesailer, izinler, mevcutlar] = await Promise.all([
    db.uzmanMesai.findMany({ where: { uzmanId, subeId }, select: { gun: true, baslangicDk: true, bitisDk: true } }),
    db.izin.findMany({ where: { uzmanId, bitis: { gt: ilk }, baslangic: { lt: son } }, select: { baslangic: true, bitis: true } }),
    db.randevu.findMany({ where: { uzmanId, bitis: { gt: ilk }, baslangic: { lt: son }, ...(haricId ? { NOT: { id: haricId } } : {}) }, select: { id: true, baslangic: true, bitis: true, durum: true } }),
  ]);
  return { mesailer, izinler, mevcutlar: mevcutlar.map((randevu) => ({ ...randevu, iptal: randevu.durum === "IPTAL" })) };
}
