import type { Role } from "@/generated/prisma/enums";
import { etkinYetki, type Modul } from "@/lib/yetkiler";

/**
 * §12.2 — Koordinatör panelinin ana modülleri.
 *
 * Menü düz bir liste değil, bölümlere ayrılmış durumda: 13 maddelik tek
 * sütun taranması zor bir yığındı. Bölüm başlığı `bolum` alanından gelir;
 * ardışık aynı değerler tek başlık altında toplanır. `simge` yan menüdeki
 * küçük çizgi ikonun adıdır (bkz. components/yan-menu.tsx).
 */
export type MenuOgesi = {
  etiket: string;
  yol: string;
  hazir: boolean;
  /** Paket numarası — hangi pakette aktifleşeceğini gösterir. */
  paket: string;
  /** Yan menüde üstüne yazılacak bölüm başlığı. */
  bolum?: string;
  /** components/yan-menu.tsx içindeki ikon adı. */
  simge?: string;
  /**
   * Maddenin bağlı olduğu yetki modülü (bkz. lib/yetkiler.ts). Boşsa panele
   * girebilen herkes görür (dashboard). Kullanıcının bu modüldeki etkin
   * yetkisi YOK ise madde menüde görünmez; LISTE dahil her seviye gösterir.
   *
   * Menüden gizlemek YETKİ DEĞİLDİR: sayfanın kendi `adminZorunlu()` /
   * `yonetimZorunlu(modul, seviye)` kontrolü esastır (bkz. lib/yetki-kapisi.ts).
   * Buradaki süzgeç yalnızca kullanıcıya giremeyeceği bir bağlantıyı
   * göstermemek için.
   */
  modul?: Modul;
};

export const KOORDINATOR_MENUSU: readonly MenuOgesi[] = [
  {
    etiket: "Dashboard",
    yol: "/koordinator",
    hazir: true,
    paket: "P2",
    simge: "panel",
  },
  {
    etiket: "Dönemler",
    yol: "/koordinator/donemler",
    modul: "donemler",
    hazir: true,
    paket: "P4",
    bolum: "Programlar",
    simge: "takvim",
  },
  {
    etiket: "Kulüpler",
    yol: "/koordinator/kulupler",
    modul: "kulupler",
    hazir: true,
    paket: "P8",
    bolum: "Programlar",
    simge: "yildiz",
  },
  {
    etiket: "Gruplar",
    yol: "/koordinator/gruplar",
    modul: "gruplar",
    hazir: true,
    paket: "P4",
    bolum: "Programlar",
    simge: "grup",
  },
  {
    etiket: "Atölye çeşitleri",
    yol: "/koordinator/atolyeler",
    modul: "atolyeler",
    hazir: true,
    paket: "P3",
    bolum: "Atölyeler",
    simge: "izgara",
  },
  {
    etiket: "Öğrenciler",
    yol: "/koordinator/ogrenciler",
    modul: "ogrenciler",
    hazir: true,
    paket: "P5",
    bolum: "Kişiler",
    simge: "kisi",
  },
  // Ayrı bir "Öğrenci kayıtları" menü maddesi yok: kaydın bütün işleri
  // (açma, programdan çıkarma, geri alma, stajyer atama) öğrencinin kendi
  // sayfasında yapılıyor. Bütün kayıtları tek listede gösteren ekran duruyor
  // ama menüde değil — dashboard'daki "Stajyeri atanmamış" kartı oraya
  // bağlanıyor ve süzgeç orada anlamlı.
  {
    etiket: "Stajyerler",
    yol: "/koordinator/stajyerler",
    modul: "stajyerler",
    hazir: true,
    paket: "P6",
    bolum: "Kişiler",
    simge: "rozet",
  },
  // Veli görüşmeleri (mini test + brief) ve terapi görüşmeleri (oyun /
  // danışan). Görüşmelerin tek yazma adresi bu ekran; öğrenci profili
  // kayıtları yalnızca gösterir. Stajyer menüsünde asla yer almaz —
  // görüşmeler sağlık bilgisi gibi stajyerden gizlidir.
  {
    etiket: "Danışmanlık",
    yol: "/koordinator/danismanlik",
    modul: "danismanlik",
    hazir: true,
    paket: "P15",
    bolum: "Kişiler",
    simge: "sohbet",
  },
  // Zeka testi sonuç belgeleri (PDF/görsel yükleme + önizleme). Danışmanlık
  // gibi: tek yazma adresi bu ekran, öğrenci profili yalnızca gösterir.
  // Stajyer menüsünde asla yer almaz — sağlık bilgisi kuralı.
  {
    etiket: "Zeka testleri",
    yol: "/koordinator/zeka-testleri",
    modul: "zekaTestleri",
    hazir: true,
    paket: "P16",
    bolum: "Kişiler",
    simge: "ampul",
  },
  // Yalnızca yöneticide. Koordinatörün Stajyerler ekranı yerinde duruyor ve
  // kendi şubesiyle sınırlı; burası bütün şubelerin hesaplarına bakan, rol ve
  // şube değiştirebilen ekran.
  {
    etiket: "Kullanıcılar",
    yol: "/koordinator/kullanicilar",
    modul: "kullanicilar",
    hazir: true,
    paket: "P14",
    bolum: "Kişiler",
    simge: "anahtar",
  },
  // Ayrı bir "Stajyer atamaları" ekranı yok: atama, stajyerin kendi
  // sayfasında (program seç → öğrencileri ata) ve öğrenci profilinde
  // (kaydın sorumlusunu seç) yapılıyor. Bütün kayıtları tek listede gösteren
  // eski ekran hangi stajyerin hangi dönemde ne kadar yükü olduğunu
  // söylemiyordu.
  {
    etiket: "Puanlamalar",
    yol: "/koordinator/puanlamalar",
    modul: "puanlamalar",
    hazir: true,
    paket: "P7",
    bolum: "Değerlendirme",
    simge: "puan",
  },
  // Raporlar için ayrı bir menü maddesi yok: rapor öğrenciye ait bir belge
  // ve öğrencinin kendi sayfasında üretilip düzenleniyor. Bütün raporların
  // tek listesi pratikte "hangi öğrencinin raporu" sorusuna cevap vermiyordu.
  {
    etiket: "Arşiv",
    yol: "/koordinator/arsiv",
    modul: "arsiv",
    hazir: true,
    paket: "P11",
    bolum: "Değerlendirme",
    simge: "arsiv",
  },
];

/** §12.3 — Stajyer panelinin ekranları. */
export const STAJYER_MENUSU: readonly MenuOgesi[] = [
  {
    etiket: "Görevlerim",
    yol: "/stajyer",
    hazir: true,
    paket: "P2",
    simge: "gorev",
  },
  {
    etiket: "Öğrencilerim",
    yol: "/stajyer/ogrencilerim",
    hazir: true,
    paket: "P7",
    simge: "kisi",
  },
  {
    etiket: "Gelişim testleri",
    yol: "/stajyer/gelisim",
    hazir: true,
    paket: "P16",
    simge: "gorev",
  },
  {
    etiket: "Doldurduğum formlar",
    yol: "/stajyer/formlarim",
    hazir: true,
    paket: "P7",
    simge: "rapor",
  },
];

/**
 * Rollerine göre kullanıcının göreceği menü.
 *
 * Panel seçimini tek yerde tutuyor: önceden her yerde
 * `role === "KOORDINATOR" ? KOORDINATOR_MENUSU : STAJYER_MENUSU` yazılıydı ve
 * bu ternary, yönetici eklenince ona sessizce STAJYER menüsünü veriyordu.
 *
 * Süzgeç yetki matrisinden beslenir: modüldeki etkin yetkisi YOK olan madde
 * gizlenir. LISTE dahil her seviye maddeyi gösterir — danışma görevlisi zeka
 * testlerinin listesini görebildiği için menüde bağlantısı da olmalı.
 */
export function panelMenusu(roller: readonly Role[]): readonly MenuOgesi[] {
  if (roller.includes("STAJYER")) return STAJYER_MENUSU;
  return KOORDINATOR_MENUSU.filter(
    (oge) => !oge.modul || etkinYetki(roller, oge.modul) !== "YOK",
  );
}

/** Panelin sol üstte yazan adı. */
export function panelBasligi(roller: readonly Role[]): string {
  if (roller.includes("STAJYER")) return "Stajyer paneli";
  if (roller.includes("ADMIN")) return "Yönetici paneli";
  if (roller.includes("SUBE_YONETICISI")) return "Şube yöneticisi paneli";
  return "Koordinatör paneli";
}
