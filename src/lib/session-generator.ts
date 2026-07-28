import type { Day } from "@/generated/prisma/enums";
import { grupTarihi } from "./tarih";

/**
 * Oturum üretimi — §2.4, §13.2, §13.5.
 *
 * Oturumlar grup açılırken fiziksel satır olarak üretilir. Bu kasıtlı bir
 * tercih: puanlama görevleri, eksik puanlama tespiti, katılım geçmişi ve
 * raporlama tek bir tabloyu sorgulayarak çıkar. Alternatifi (oturumları her
 * ekranda tarihten hesaplamak) aynı takvim mantığını onlarca yerde tekrar
 * ederdi.
 *
 * `startWeekNumber` kuralının tek sahibi bu dosyadır.
 */

export type HaftaGirdisi = {
  id: string;
  weekNumber: number;
  /** Haftanın çapası: o hafta sonunun CUMARTESİ tarihi. */
  date: Date;
};

export type UretilecekOturum = {
  workshopTypeId: string;
  termWeekId: string | null;
  date: Date;
};

/**
 * Bir dönem grubunun bütün oturumlarını üretir.
 *
 * §13.5 — Dönem başladıktan sonra açılan grup geçmiş haftaları telafi etmez.
 * `baslangicHaftasi` 1 ise 10 haftanın tamamı, 4 ise yalnızca 4–10 haftaları
 * üretilir. 10 hafta × 5 atölye = 50 oturum; 4. haftadan başlayan grup için
 * 7 hafta × 5 atölye = 35 oturum.
 *
 * Oturum tarihi grubun gününe göre hesaplanır: cumartesi grubu haftanın
 * cumartesisinde, pazar grubu ertesi gün toplanır.
 */
export function donemOturumlariniUret({
  haftalar,
  atolyeIdleri,
  grupGunu,
  baslangicHaftasi,
}: {
  haftalar: readonly HaftaGirdisi[];
  atolyeIdleri: readonly string[];
  grupGunu: Day;
  baslangicHaftasi: number;
}): UretilecekOturum[] {
  const oturumlar: UretilecekOturum[] = [];

  const ilgiliHaftalar = haftalar
    .filter((hafta) => hafta.weekNumber >= baslangicHaftasi)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  for (const hafta of ilgiliHaftalar) {
    for (const atolyeId of atolyeIdleri) {
      oturumlar.push({
        workshopTypeId: atolyeId,
        termWeekId: hafta.id,
        date: grupTarihi(hafta.date, grupGunu),
      });
    }
  }

  return oturumlar;
}

/**
 * Bir kulüp grubunun oturumlarını üretir.
 *
 * §2.5 — Kulüp tek yarım gün sürer ve 3 atölye içerir; hafta kavramı yoktur,
 * bu yüzden `termWeekId` boş kalır.
 */
export function kulupOturumlariniUret({
  tarih,
  atolyeIdleri,
}: {
  tarih: Date;
  atolyeIdleri: readonly string[];
}): UretilecekOturum[] {
  return atolyeIdleri.map((atolyeId) => ({
    workshopTypeId: atolyeId,
    termWeekId: null,
    date: tarih,
  }));
}

/**
 * Dönem başladıktan sonra açılan bir grubun hangi haftadan başlayacağını
 * belirler: bugünden itibaren yapılacak ilk eğitim haftası.
 *
 * Dönem henüz başlamadıysa 1 döner (grup baştan katılır). Dönemin bütün
 * haftaları geçmişse null döner — böyle bir gruba üretilecek oturum yoktur ve
 * koordinatöre bu durum söylenmelidir.
 */
export function mevcutHaftaNumarasi(
  haftalar: readonly HaftaGirdisi[],
  bugun: Date,
): number | null {
  const gelecekHaftalar = haftalar
    .filter((hafta) => hafta.date.getTime() >= bugun.getTime())
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const ilk = gelecekHaftalar[0];
  return ilk ? ilk.weekNumber : null;
}
