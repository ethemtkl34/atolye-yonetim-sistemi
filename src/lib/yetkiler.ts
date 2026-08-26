import type { Role } from "@/generated/prisma/enums";

/**
 * Yetki matrisi — hangi rol hangi modülde ne yapabilir, tek kaynak burası.
 *
 * `roller.ts` gibi bilerek bağımlılıksız: ne veritabanı ne Auth.js var,
 * `proxy.ts` ve `navigasyon.ts` güvenle import edebilir.
 *
 * Kurallar:
 * - Bir kullanıcı birden çok rol taşıyabilir (`User.roles`); etkin yetki
 *   rollerin BİRLEŞİMİDİR — her modülde en yüksek seviye geçerlidir.
 * - Matris `Record<Role, Record<Modul, Seviye>>`: yeni bir rol veya modül
 *   eklendiğinde satırı/sütunu yazılmadan dosya DERLENMEZ. `roller.ts`'teki
 *   ders: rol ikiliyken yazılmış ternary'ler üçüncü rol gelince sessizce
 *   yanlış dalı seçiyordu.
 * - Menüden gizlemek yetki değildir (bkz. navigasyon.ts): asıl kontrol
 *   sayfa ve Server Action guard'larında `yetkiYeter()` ile yapılır.
 */

export const MODULLER = [
  "donemler",
  "kulupler",
  "gruplar",
  "atolyeler",
  "mufredat",
  "ogrenciler",
  "adaylar",
  "kayitlar",
  "stajyerler",
  "danismanlik",
  "zekaTestleri",
  "puanlamalar",
  "raporlar",
  "arsiv",
  "kullanicilar",
] as const;

export type Modul = (typeof MODULLER)[number];

/**
 * Sıralı yetki seviyeleri: YOK < LISTE < GORUNTULE < TAM.
 *
 * LISTE yalnızca zeka testlerinde anlamlı: üstveri listesi görünür (hangi
 * öğrenciye hangi tarihte hangi test), belge İÇERİĞİ açılamaz/indirilemez.
 * Belge indirme rotası bu yüzden GORUNTULE ister, liste sayfası LISTE ile
 * yetinir. Ayrı bir "belgeler" modülü açmak matrisi tek istisna için
 * şişirirdi.
 */
export type Seviye = "YOK" | "LISTE" | "GORUNTULE" | "TAM";

const SEVIYE_SIRASI: Record<Seviye, number> = {
  YOK: 0,
  LISTE: 1,
  GORUNTULE: 2,
  TAM: 3,
};

function tumModuller(seviye: Seviye): Record<Modul, Seviye> {
  return Object.fromEntries(
    MODULLER.map((modul) => [modul, seviye]),
  ) as Record<Modul, Seviye>;
}

/**
 * Koordinatör ve psikolog aynı satırı paylaşır: yetkilendirme matrisinde
 * ikisi de tam panel kullanır. Tek fark zeka testlerinde — sonuç belgesi
 * yükleme/silme yalnızca Test Uygulayıcısı unvanındadır, diğerleri belgeleri
 * yalnızca görüntüler.
 */
const KOORDINATOR_SATIRI: Record<Modul, Seviye> = {
  donemler: "TAM",
  kulupler: "TAM",
  gruplar: "TAM",
  atolyeler: "TAM",
  mufredat: "TAM",
  ogrenciler: "TAM",
  adaylar: "TAM",
  kayitlar: "TAM",
  stajyerler: "TAM",
  danismanlik: "TAM",
  zekaTestleri: "GORUNTULE",
  puanlamalar: "TAM",
  raporlar: "TAM",
  arsiv: "TAM",
  kullanicilar: "YOK",
};

export const YETKI_MATRISI: Record<Role, Record<Modul, Seviye>> = {
  /** Kurum Yöneticisi — her şey, kullanıcı yönetimi dahil. */
  ADMIN: tumModuller("TAM"),

  /**
   * Şube Yöneticisi — koordinatörün bütün yetkileri, ARTI kullanıcı yönetimi.
   *
   * Rolü koordinatörden ayıran tek satır `kullanicilar`; şubenin başındaki
   * kişi kendi kadrosunu yönetici beklemeden açıp kapatabilsin diye eklendi.
   * Kurum Yöneticisi'nden ayıran şey burada değil, ŞUBE bağında: bu rol her
   * zaman bir şubeye bağlıdır ve kullanıcı ekranı da o şubeyle sınırlıdır
   * (bkz. roller.ts `kullaniciYonetimiKapsami`). Matris şubeye bakmaz —
   * "ne yapabilir" sorusunun cevabı burada, "kimin üzerinde" sorusununki
   * kapsam fonksiyonunda.
   */
  SUBE_YONETICISI: { ...KOORDINATOR_SATIRI, kullanicilar: "TAM" },

  /** Atölye Koordinatörü. */
  KOORDINATOR: KOORDINATOR_SATIRI,

  /** Atölye Psikoloğu — koordinatörle birebir aynı yetki, ayrı unvan. */
  ATOLYE_PSIKOLOGU: KOORDINATOR_SATIRI,

  /**
   * Test Uygulayıcısı — tek başına yalnızca zeka testi sonuçlarını sisteme
   * girer/siler. Pratikte psikolog rolüyle birlikte verilir; birleşimde
   * zekaTestleri TAM'a yükselir, kalan yetkiler psikologdan gelir.
   */
  TEST_UYGULAYICISI: { ...tumModuller("YOK"), zekaTestleri: "TAM" },

  /**
   * Danışma Görevlisi — kayıt masası: öğrenci, aday ve kayıt işlemleri tam,
   * programlar salt görüntüleme, zeka testlerinde yalnız liste. Görüşmeler
   * (danışmanlık) sağlık mahremiyeti gereği stajyerdeki gibi TAMAMEN gizli;
   * puanlama/rapor/arşiv ve müfredat yönetimi bu masanın işi değil.
   *
   * Adaylar bu masanın ASIL işi: telefonun başındaki kişi aday açar, arar,
   * aşama yürütür, dönüştürür. Aday verisi sağlık/görüşme mahremiyeti
   * sınıfında değil, kayıt masası verisidir — ogrenciler/kayitlar TAM ile
   * tutarlı.
   */
  DANISMA_GOREVLISI: {
    ...tumModuller("YOK"),
    ogrenciler: "TAM",
    adaylar: "TAM",
    kayitlar: "TAM",
    donemler: "GORUNTULE",
    kulupler: "GORUNTULE",
    gruplar: "GORUNTULE",
    zekaTestleri: "LISTE",
  },

  /**
   * Stajyerin erişimi bu matristen değil kendi panelinden (/stajyer) gelir;
   * koordinatör paneli modüllerinin hepsi kapalı.
   */
  STAJYER: tumModuller("YOK"),
};

/** Rol birleşiminin bir modüldeki etkin yetkisi: en yüksek seviye kazanır. */
export function etkinYetki(roller: readonly Role[], modul: Modul): Seviye {
  let sonuc: Seviye = "YOK";
  for (const rol of roller) {
    const seviye = YETKI_MATRISI[rol][modul];
    if (SEVIYE_SIRASI[seviye] > SEVIYE_SIRASI[sonuc]) sonuc = seviye;
  }
  return sonuc;
}

/** Etkin yetki istenen seviyeye ulaşıyor mu. */
export function yetkiYeter(
  roller: readonly Role[],
  modul: Modul,
  gereken: Seviye,
): boolean {
  return SEVIYE_SIRASI[etkinYetki(roller, modul)] >= SEVIYE_SIRASI[gereken];
}

/**
 * Bütün modüllerin etkin yetkileri tek seferde — `SubeliKullanici.yetkiler`
 * için. Sayfalar `kullanici.yetkiler.zekaTestleri === "TAM"` gibi okuyup
 * arayüz modunu seçer; her bileşende ayrı ayrı hesaplamaya gerek kalmaz.
 */
export function yetkileriHesapla(
  roller: readonly Role[],
): Record<Modul, Seviye> {
  return Object.fromEntries(
    MODULLER.map((modul) => [modul, etkinYetki(roller, modul)]),
  ) as Record<Modul, Seviye>;
}
