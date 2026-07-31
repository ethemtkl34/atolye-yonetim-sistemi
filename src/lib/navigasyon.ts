/**
 * §12.2 — Koordinatör panelinin 13 ana modülü.
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
  {
    etiket: "Stajyer atamaları",
    yol: "/koordinator/atamalar",
    hazir: true,
    paket: "P6",
    bolum: "Kişiler",
    simge: "atama",
  },
  {
    etiket: "Puanlamalar",
    yol: "/koordinator/puanlamalar",
    hazir: true,
    paket: "P7",
    bolum: "Değerlendirme",
    simge: "puan",
  },
  {
    etiket: "Raporlar",
    yol: "/koordinator/raporlar",
    hazir: true,
    paket: "P9",
    bolum: "Değerlendirme",
    simge: "rapor",
  },
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
