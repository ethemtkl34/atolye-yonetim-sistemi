import type { Role } from "@/generated/prisma/enums";

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
   * Maddeyi görebilecek roller. Boşsa herkes görür.
   *
   * Menüden gizlemek YETKİ DEĞİLDİR: sayfanın kendi `adminZorunlu()` /
   * `yonetimZorunlu()` kontrolü esastır (bkz. lib/auth-guard.ts). Buradaki
   * süzgeç yalnızca kullanıcıya giremeyeceği bir bağlantıyı göstermemek için.
   */
  roller?: readonly Role[];
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
    hazir: true,
    paket: "P4",
    bolum: "Programlar",
    simge: "takvim",
  },
  {
    etiket: "Kulüpler",
    yol: "/koordinator/kulupler",
    hazir: true,
    paket: "P8",
    bolum: "Programlar",
    simge: "yildiz",
  },
  {
    etiket: "Gruplar",
    yol: "/koordinator/gruplar",
    hazir: true,
    paket: "P4",
    bolum: "Programlar",
    simge: "grup",
  },
  {
    etiket: "Atölye çeşitleri",
    yol: "/koordinator/atolyeler",
    hazir: true,
    paket: "P3",
    bolum: "Atölyeler",
    simge: "izgara",
  },
  {
    etiket: "Değerlendirme soruları",
    yol: "/koordinator/sorular",
    hazir: true,
    paket: "P3",
    bolum: "Atölyeler",
    simge: "liste",
  },
  {
    etiket: "Öğrenciler",
    yol: "/koordinator/ogrenciler",
    hazir: true,
    paket: "P5",
    bolum: "Kişiler",
    simge: "kisi",
  },
  {
    etiket: "Öğrenci kayıtları",
    yol: "/koordinator/kayitlar",
    hazir: true,
    paket: "P6",
    bolum: "Kişiler",
    simge: "pano",
  },
  {
    etiket: "Stajyerler",
    yol: "/koordinator/stajyerler",
    hazir: true,
    paket: "P6",
    bolum: "Kişiler",
    simge: "rozet",
  },
  // Yalnızca yöneticide. Koordinatörün Stajyerler ekranı yerinde duruyor ve
  // kendi şubesiyle sınırlı; burası bütün şubelerin hesaplarına bakan, rol ve
  // şube değiştirebilen ekran.
  {
    etiket: "Kullanıcılar",
    yol: "/koordinator/kullanicilar",
    hazir: true,
    paket: "P14",
    bolum: "Kişiler",
    simge: "anahtar",
    roller: ["ADMIN"],
  },
  // Ayrı bir "Stajyer atamaları" ekranı yok: atama, stajyerin kendi
  // sayfasında (program seç → öğrencileri ata) ve öğrenci profilinde
  // (kaydın sorumlusunu seç) yapılıyor. Bütün kayıtları tek listede gösteren
  // eski ekran hangi stajyerin hangi dönemde ne kadar yükü olduğunu
  // söylemiyordu.
  {
    etiket: "Puanlamalar",
    yol: "/koordinator/puanlamalar",
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
    etiket: "Doldurduğum formlar",
    yol: "/stajyer/formlarim",
    hazir: true,
    paket: "P7",
    simge: "rapor",
  },
];

/**
 * Rolüne göre kullanıcının göreceği menü.
 *
 * Panel seçimini tek yerde tutuyor: önceden her yerde
 * `role === "KOORDINATOR" ? KOORDINATOR_MENUSU : STAJYER_MENUSU` yazılıydı ve
 * bu ternary, yönetici eklenince ona sessizce STAJYER menüsünü veriyordu.
 */
export function panelMenusu(role: Role): readonly MenuOgesi[] {
  if (role === "STAJYER") return STAJYER_MENUSU;
  return KOORDINATOR_MENUSU.filter(
    (oge) => !oge.roller || oge.roller.includes(role),
  );
}

/** Panelin sol üstte yazan adı. */
export function panelBasligi(role: Role): string {
  if (role === "STAJYER") return "Stajyer paneli";
  if (role === "ADMIN") return "Yönetici paneli";
  return "Koordinatör paneli";
}
