import type { Day, DayMode, TimeSlot } from "@/generated/prisma/enums";

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
  PAZARTESI: "Pazartesi",
  SALI: "Salı",
  CARSAMBA: "Çarşamba",
  PERSEMBE: "Perşembe",
  CUMA: "Cuma",
  CUMARTESI: "Cumartesi",
  PAZAR: "Pazar",
};

/**
 * Takvim sırası. Hafta çapası PAZARTESİ olduğu için bu dizideki sıra aynı
 * zamanda çapaya eklenecek gün sayısıdır: `grupTarihi` buna güvenir.
 */
export const GUN_SIRASI: Day[] = [
  "PAZARTESI",
  "SALI",
  "CARSAMBA",
  "PERSEMBE",
  "CUMA",
  "CUMARTESI",
  "PAZAR",
];

/** Gün düzeninin kapsadığı günler — grup formundaki liste buradan gelir. */
export const DUZEN_GUNLERI: Record<DayMode, Day[]> = {
  HAFTA_SONU: ["CUMARTESI", "PAZAR"],
  HAFTA_ICI: ["PAZARTESI", "SALI", "CARSAMBA", "PERSEMBE", "CUMA"],
};

export const GUN_DUZENI_ADLARI: Record<DayMode, string> = {
  HAFTA_SONU: "Hafta sonu",
  HAFTA_ICI: "Hafta içi",
};

/** Günleri takvim sırasına dizer — kullanıcı hangi sırayla işaretlerse işaretlesin. */
export function gunleriSirala(gunler: readonly Day[]): Day[] {
  return GUN_SIRASI.filter((gun) => gunler.includes(gun));
}

export const ZAMAN_DILIMI_ADLARI: Record<TimeSlot, string> = {
  OGLEDEN_ONCE: "Öğleden önce",
  OGLEDEN_SONRA: "Öğleden sonra",
};

/**
 * "Cumartesi öğleden önce" / "Pazartesi, Çarşamba öğleden önce" gibi tek
 * satırlık grup zamanı.
 *
 * Zaman dilimi bütün günlerde aynı; grup haftada kaç gün toplanırsa toplansın
 * tek dilime bağlı (bkz. `Group.timeSlot`).
 */
export function grupZamani(gunler: readonly Day[], dilim: TimeSlot): string {
  const adlar = gunleriSirala(gunler).map((gun) => GUN_ADLARI[gun]);
  const dilimAdi = ZAMAN_DILIMI_ADLARI[dilim].toLocaleLowerCase("tr-TR");
  return adlar.length === 0
    ? dilimAdi
    : `${adlar.join(", ")} ${dilimAdi}`;
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

/** Bir tarihin haftanın hangi gününe denk geldiği. */
export function gunundenGun(tarih: Date): Day {
  // getUTCDay(): 0 = Pazar. GUN_SIRASI pazartesiden başlıyor.
  const gun = tarih.getUTCDay();
  return GUN_SIRASI[(gun + 6) % 7];
}

/**
 * Bir tarihi kendi haftasının PAZARTESİ'sine sabitler.
 *
 * Dönem haftaları tek bir "çapa" tarihle saklanır çünkü aynı dönemde farklı
 * günlerde toplanan gruplar olabilir; her grup kendi gününde toplanır.
 * Koordinatör takvimden haftanın hangi gününü seçerse seçsin aynı hafta
 * kaydedilir.
 *
 * Çapa eskiden cumartesiydi ve pazar grubu "çapa + 1" diye bulunuyordu; hafta
 * içi günler bu hesaba sığmadığı için çapa haftanın başına alındı.
 */
export function haftaBasi(tarih: Date): Date {
  const gun = tarih.getUTCDay();
  return gunEkle(tarih, -((gun + 6) % 7));
}

/** Hafta çapasından (pazartesi) o grubun gerçek toplanma tarihi. */
export function grupTarihi(haftaBasi: Date, gun: Day): Date {
  return gunEkle(haftaBasi, GUN_SIRASI.indexOf(gun));
}

/**
 * Haftanın eğitim günlerini tek satırda gösterir. Ay veya yıl sınırında
 * kısaltma yapılmaz ki "31 Ekim – 1 Kasım 2026" gibi durumlar yanlış
 * okunmasın.
 *
 *   17–18 Ekim 2026      (hafta sonu)
 *   12–16 Ekim 2026      (hafta içi)
 */
export function haftaBicimle(haftaBasi: Date, duzen: DayMode): string {
  const gunler = DUZEN_GUNLERI[duzen];
  const ilk = grupTarihi(haftaBasi, gunler[0]);
  const son = grupTarihi(haftaBasi, gunler[gunler.length - 1]);

  if (ilk.getTime() === son.getTime()) return tarihBicimle(ilk);

  if (ilk.getUTCMonth() === son.getUTCMonth()) {
    return `${ilk.getUTCDate()}–${tarihBicimle(son)}`;
  }

  return `${tarihBicimle(ilk)} – ${tarihBicimle(son)}`;
}

/**
 * Doğum tarihinden yaş metni: "7 yaş 4 ay 16 gün".
 *
 * Takvim farkıyla hesaplanır (30 günlük ay varsayımı değil): gün eksiye
 * düşerse referans ayından önceki ayın gün sayısı kadar ödünç alınır.
 * Bir yaşından küçüklerde "yaş" parçası yazılmaz ("4 ay 12 gün").
 */
export function yasBicimle(dogum: Date, referans: Date): string {
  // Dolmuş ay sayısı: son "ay dönümü" henüz gelmediyse bir eksik. Ay dönümü
  // günü, kısa aylarda ay sonuna kıstırılır (31 Ocak doğumlunun şubat dönümü
  // 28 Şubat) — yoksa gün farkı eksiye düşer ve tek ödünç yetmez.
  const refAySonu = new Date(
    Date.UTC(referans.getUTCFullYear(), referans.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const donumGunu = Math.min(dogum.getUTCDate(), refAySonu);

  let toplamAy =
    (referans.getUTCFullYear() - dogum.getUTCFullYear()) * 12 +
    (referans.getUTCMonth() - dogum.getUTCMonth());
  if (referans.getUTCDate() < donumGunu) toplamAy -= 1;

  // Son ay dönümünün gerçek tarihi; gün, referansla arasındaki mesafe.
  const capaAySonu = new Date(
    Date.UTC(dogum.getUTCFullYear(), dogum.getUTCMonth() + toplamAy + 1, 0),
  ).getUTCDate();
  const capa = Date.UTC(
    dogum.getUTCFullYear(),
    dogum.getUTCMonth() + toplamAy,
    Math.min(dogum.getUTCDate(), capaAySonu),
  );
  const gun = Math.round((referans.getTime() - capa) / GUNDE_MS);

  const yil = Math.floor(toplamAy / 12);
  const ay = toplamAy % 12;

  const parcalar = [];
  if (yil > 0) parcalar.push(`${yil} yaş`);
  parcalar.push(`${ay} ay`, `${gun} gün`);
  return parcalar.join(" ");
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
