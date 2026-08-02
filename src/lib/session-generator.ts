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
  /** Gösterim için hafta numarası; telafi günlerinde boş kalır. */
  weekNumber: number | null;
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
        weekNumber: hafta.weekNumber,
        date: grupTarihi(hafta.date, grupGunu),
      });
    }
  }

  return oturumlar;
}

/**
 * Bir kulüp grubunun oturumlarını üretir.
 *
 * Kulüp eskiden TEK yarım gündü; artık birden çok haftaya yayılabiliyor ve
 * hafta sayısı serbest. Tarihler kulübün kendi listesinden geliyor
 * (`Club.weekDates`), dönemdeki gibi bir çapa hesabı yok: kulüp haftaları
 * doğrudan seçilen günlerdir.
 *
 * `termWeekId` boş kalmaya devam ediyor — kulübün `TermWeek` kaydı yok. Hafta
 * numarası oturumun kendi alanında taşınıyor.
 */
export function kulupOturumlariniUret({
  tarihler,
  atolyeIdleri,
}: {
  tarihler: readonly Date[];
  atolyeIdleri: readonly string[];
}): UretilecekOturum[] {
  const oturumlar: UretilecekOturum[] = [];

  const sirali = [...tarihler].sort((a, b) => a.getTime() - b.getTime());

  for (const [sira, tarih] of sirali.entries()) {
    for (const atolyeId of atolyeIdleri) {
      oturumlar.push({
        workshopTypeId: atolyeId,
        termWeekId: null,
        weekNumber: sira + 1,
        date: tarih,
      });
    }
  }

  return oturumlar;
}

/**
 * Dönem başladıktan sonra açılan bir grubun hangi haftadan başlayacağını
 * belirler: bugünden itibaren yapılacak ilk eğitim haftası.
 *
 * `grupGunu` verilirse hafta, çapa (cumartesi) yerine grubun gerçek toplanma
 * tarihine göre değerlendirilir. Bu fark pazar gruplarında önemli: pazar günü
 * açılan bir pazar grubunun o haftaki oturumu henüz yapılmamıştır; çapaya
 * bakılsaydı (cumartesi < bugün) hafta geçmiş sayılır ve grup 5 oturumunu
 * sessizce kaybederdi.
 *
 * Dönem henüz başlamadıysa 1 döner (grup baştan katılır). Dönemin bütün
 * haftaları geçmişse null döner — böyle bir gruba üretilecek oturum yoktur ve
 * koordinatöre bu durum söylenmelidir.
 */
export function mevcutHaftaNumarasi(
  haftalar: readonly HaftaGirdisi[],
  bugun: Date,
  grupGunu?: Day,
): number | null {
  const gelecekHaftalar = haftalar
    .filter((hafta) => {
      const toplanma = grupGunu ? grupTarihi(hafta.date, grupGunu) : hafta.date;
      return toplanma.getTime() >= bugun.getTime();
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const ilk = gelecekHaftalar[0];
  return ilk ? ilk.weekNumber : null;
}
