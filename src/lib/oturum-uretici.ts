import type { Day } from "@/generated/prisma/enums";
import { grupTarihi, gunEkle, gunleriSirala } from "./tarih";

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
  /** Haftanın çapası: o haftanın PAZARTESİ tarihi. */
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
 * `baslangicHaftasi` 1 ise haftaların tamamı, 4 ise yalnızca 4. haftadan
 * sonrası üretilir.
 *
 * Grup haftada birden çok gün toplanabilir ve HER toplanma gününde dönemin
 * bütün atölyeleri yapılır. Oturum sayısı bu yüzden üç çarpanın çarpımıdır:
 * hafta × gün × atölye. 10 hafta × 1 gün × 5 atölye = 50 oturum;
 * 10 hafta × 2 gün × 5 atölye = 100 oturum.
 *
 * Günler takvim sırasına diziliyor: üretim sırası ekrandaki sırayla aynı
 * kalsın diye, koordinatör kutuları hangi sırayla işaretlerse işaretlesin.
 */
export function donemOturumlariniUret({
  haftalar,
  atolyeIdleri,
  grupGunleri,
  baslangicHaftasi,
}: {
  haftalar: readonly HaftaGirdisi[];
  atolyeIdleri: readonly string[];
  grupGunleri: readonly Day[];
  baslangicHaftasi: number;
}): UretilecekOturum[] {
  const oturumlar: UretilecekOturum[] = [];

  const ilgiliHaftalar = haftalar
    .filter((hafta) => hafta.weekNumber >= baslangicHaftasi)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const gunler = gunleriSirala(grupGunleri);

  for (const hafta of ilgiliHaftalar) {
    for (const gun of gunler) {
      for (const atolyeId of atolyeIdleri) {
        oturumlar.push({
          workshopTypeId: atolyeId,
          termWeekId: hafta.id,
          weekNumber: hafta.weekNumber,
          date: grupTarihi(hafta.date, gun),
        });
      }
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
 * `grupGunleri` verilirse hafta, çapa (pazartesi) yerine grubun gerçek
 * toplanma tarihlerine göre değerlendirilir. Fark haftanın sonuna düşen
 * gruplarda önemli: cumartesi günü açılan bir cumartesi grubunun o haftaki
 * oturumu henüz yapılmamıştır; çapaya bakılsaydı (pazartesi < bugün) hafta
 * geçmiş sayılır ve grup o haftanın oturumlarını sessizce kaybederdi.
 *
 * Çok günlü grupta grubun O HAFTAKİ SON toplanma günü esas alınır: haftanın
 * bir günü geçmiş olsa da sonraki günü duruyorsa hafta hâlâ yapılacaktır.
 *
 * Dönem henüz başlamadıysa 1 döner (grup baştan katılır). Dönemin bütün
 * haftaları geçmişse null döner — böyle bir gruba üretilecek oturum yoktur ve
 * koordinatöre bu durum söylenmelidir.
 */
export function mevcutHaftaNumarasi(
  haftalar: readonly HaftaGirdisi[],
  bugun: Date,
  grupGunleri?: readonly Day[],
): number | null {
  const gunler = grupGunleri ? gunleriSirala(grupGunleri) : [];

  const gelecekHaftalar = haftalar
    .filter((hafta) => {
      // Gün verilmediyse haftanın SONU esas alınır: çapa (pazartesi) geçmiş
      // olsa da o haftanın cumartesisi hâlâ yapılacak olabilir. Dönem
      // sayfasındaki "yeni grup kaçıncı haftadan başlar" tahmini bunu kullanıyor.
      const sonToplanma =
        gunler.length > 0
          ? grupTarihi(hafta.date, gunler[gunler.length - 1])
          : gunEkle(hafta.date, 6);
      return sonToplanma.getTime() >= bugun.getTime();
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const ilk = gelecekHaftalar[0];
  return ilk ? ilk.weekNumber : null;
}
