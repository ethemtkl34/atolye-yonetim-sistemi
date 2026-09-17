import { db } from "@/lib/db";
import type { RandevuEngeli } from "@/lib/randevu/cakisma";

/** DB okuyan çakışma bağlamı; karar `cakisma.ts` içinde saf kalır. */
export async function uzmanBaglami(args: { uzmanId: string; subeId: string; ilk: Date; son: Date; haricId?: string }) {
  const { uzmanId, subeId, ilk, son, haricId } = args;
  const [mesailer, izinler, mevcutlar] = await Promise.all([
    db.uzmanMesai.findMany({ where: { uzmanId, subeId }, select: { gun: true, baslangicDk: true, bitisDk: true } }),
    db.izin.findMany({ where: { uzmanId, bitis: { gt: ilk }, baslangic: { lt: son } }, select: { baslangic: true, bitis: true } }),
    // şube-muaf: çakışma ŞUBELER ARASI — uzman iki şubede çalışabiliyor;
    // yalnız zaman ve şube adı okunuyor, kişisel veri yok.
    db.randevu.findMany({ where: { uzmanId, bitis: { gt: ilk }, baslangic: { lt: son }, ...(haricId ? { NOT: { id: haricId } } : {}) }, select: { id: true, baslangic: true, bitis: true, durum: true, branchId: true, branch: { select: { name: true } } } }),
  ]);
  return { mesailer, izinler, mevcutlar: mevcutlar.map((randevu) => ({ ...randevu, iptal: randevu.durum === "IPTAL" })) };
}

/**
 * Engel mesajı, çakışan randevu BAŞKA şubedeyse şube adıyla (Eylül 2026).
 *
 * Takvim yalnız sağ üstte seçili şubenin randevularını gösteriyor; uzmanın
 * öbür şubedeki seansı ekranda görünmediği için "başka bir randevusu var"
 * demek kullanıcıyı boş görünen saate bakıp şaşırtırdı.
 */
export function engelMesaji(
  engel: RandevuEngeli,
  baglam: Awaited<ReturnType<typeof uzmanBaglami>>,
  subeId: string,
): string {
  if (engel.tur !== "cakisma") return engel.mesaj;
  const cakisan = baglam.mevcutlar.find((randevu) => randevu.id === engel.cakisanId);
  if (!cakisan || cakisan.branchId === subeId) return engel.mesaj;
  return `${engel.mesaj.replace(/\.$/, "")} (${cakisan.branch.name} şubesinde).`;
}
