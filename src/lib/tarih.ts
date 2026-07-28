import type { Day, TimeSlot } from "@/generated/prisma/enums";

/**
 * Tarih yardımcıları.
 *
 * ÖNEMLİ: Bu dosyadaki her işlem UTC üzerinden yapılır. Veritabanındaki
 * `@db.Date` alanları saat bilgisi taşımaz ve UTC gece yarısı olarak gelir;
 * yerel saat dilimiyle işlem yapmak sunucunun bulunduğu yere göre bir gün
 * kayması üretebilirdi. Ay adları da yerel ayara bırakılmadan burada sabit
 * tutuldu ki çıktı her ortamda aynı olsun.
 */

const AYLAR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const GUNLER = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const GUNDE_MS = 24 * 60 * 60 * 1000;

export const GUN_ADLARI: Record<Day, string> = {
  CUMARTESI: "Cumartesi",
  PAZAR: "Pazar",
};

export const ZAMAN_DILIMI_ADLARI: Record<TimeSlot, string> = {
  OGLEDEN_ONCE: "Öğleden önce",
  OGLEDEN_SONRA: "Öğleden sonra",
};

/** "Cumartesi öğleden önce" gibi tek satırlık grup zamanı. */
export function grupZamani(gun: Day, dilim: TimeSlot): string {
  return `${GUN_ADLARI[gun]} ${ZAMAN_DILIMI_ADLARI[dilim].toLocaleLowerCase("tr-TR")}`;
}

/** "YYYY-MM-DD" metnini UTC gece yarısına sabitlenmiş Date'e çevirir. */
export function tarihCozumle(metin: string): Date | null {
  const eslesme = /^(\d{4})-(\d{2})-(\d{2})$/.exec(metin);
  if (!eslesme) return null;

  const [, yil, ay, gun] = eslesme;
  const tarih = new Date(
    Date.UTC(Number(yil), Number(ay) - 1, Number(gun)),
  );

  // 31 Şubat gibi taşan tarihleri yakalar.
  if (
    tarih.getUTCFullYear() !== Number(yil) ||
    tarih.getUTCMonth() !== Number(ay) - 1 ||
    tarih.getUTCDate() !== Number(gun)
  ) {
    return null;
  }

  return tarih;
}

/** Date'i form ve HTML input'ları için "YYYY-MM-DD" biçimine çevirir. */
export function tarihMetni(tarih: Date): string {
  const yil = tarih.getUTCFullYear();
  const ay = String(tarih.getUTCMonth() + 1).padStart(2, "0");
  const gun = String(tarih.getUTCDate()).padStart(2, "0");
  return `${yil}-${ay}-${gun}`;
}

/** "18 Ekim 2026" */
export function tarihBicimle(tarih: Date): string {
  return `${tarih.getUTCDate()} ${AYLAR[tarih.getUTCMonth()]} ${tarih.getUTCFullYear()}`;
}

/** "18 Ekim 2026, Cumartesi" */
export function tarihGunleBicimle(tarih: Date): string {
  return `${tarihBicimle(tarih)}, ${GUNLER[tarih.getUTCDay()]}`;
}

export function gunEkle(tarih: Date, gunSayisi: number): Date {
  return new Date(tarih.getTime() + gunSayisi * GUNDE_MS);
}

export function haftaSonuMu(tarih: Date): boolean {
  const gun = tarih.getUTCDay();
  return gun === 0 || gun === 6;
}

/**
 * Bir hafta sonu tarihini o haftanın CUMARTESİ'sine sabitler.
 *
 * Dönem haftaları tek bir "çapa" tarihle saklanır çünkü aynı dönemde hem
 * cumartesi hem pazar grupları olabilir; her grup kendi gününde toplanır.
 * Koordinatör takvimden cumartesiyi de pazarı da seçse aynı hafta kaydedilir.
 * Hafta içi bir tarih verilirse null döner.
 */
export function haftaCapasi(tarih: Date): Date | null {
  const gun = tarih.getUTCDay();
  if (gun === 6) return tarih;
  if (gun === 0) return gunEkle(tarih, -1);
  return null;
}

/** Hafta çapasından (cumartesi) o grubun gerçek toplanma tarihi. */
export function grupTarihi(haftaCapasi: Date, gun: Day): Date {
  return gun === "CUMARTESI" ? haftaCapasi : gunEkle(haftaCapasi, 1);
}

/**
 * Hafta sonunu tek satırda gösterir. Ay veya yıl sınırında kısaltma
 * yapılmaz ki "31 Ekim – 1 Kasım 2026" gibi durumlar yanlış okunmasın.
 *
 *   17–18 Ekim 2026
 *   31 Ekim – 1 Kasım 2026
 */
export function haftaSonuBicimle(cumartesi: Date): string {
  const pazar = gunEkle(cumartesi, 1);

  if (cumartesi.getUTCMonth() === pazar.getUTCMonth()) {
    return `${cumartesi.getUTCDate()}–${tarihBicimle(pazar)}`;
  }

  return `${tarihBicimle(cumartesi)} – ${tarihBicimle(pazar)}`;
}

/** Bugünün UTC gece yarısına sabitlenmiş hali — karşılaştırmalar için. */
export function bugun(): Date {
  const simdi = new Date();
  return new Date(
    Date.UTC(
      simdi.getUTCFullYear(),
      simdi.getUTCMonth(),
      simdi.getUTCDate(),
    ),
  );
}
