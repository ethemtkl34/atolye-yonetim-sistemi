/**
 * §12.2 — Koordinatör panelinin 13 ana modülü.
 *
 * `hazir: false` olan modüller menüde görünür ama tıklanamaz. Amaç ürünün
 * bütününü baştan göstermek ve henüz yazılmamış bir sayfaya götürüp 404
 * vermemek. Her paket bittiğinde ilgili maddenin `hazir` değeri true olur.
 */
export type MenuOgesi = {
  etiket: string;
  yol: string;
  hazir: boolean;
  /** Paket numarası — hangi pakette aktifleşeceğini gösterir. */
  paket: string;
};

export const KOORDINATOR_MENUSU: readonly MenuOgesi[] = [
  { etiket: "Dashboard", yol: "/koordinator", hazir: true, paket: "P2" },
  { etiket: "Dönemler", yol: "/koordinator/donemler", hazir: true, paket: "P4" },
  { etiket: "Gruplar", yol: "/koordinator/gruplar", hazir: true, paket: "P4" },
  { etiket: "Kulüpler", yol: "/koordinator/kulupler", hazir: true, paket: "P8" },
  {
    etiket: "Atölye çeşitleri",
    yol: "/koordinator/atolyeler",
    hazir: true,
    paket: "P3",
  },
  {
    etiket: "Değerlendirme soruları",
    yol: "/koordinator/sorular",
    hazir: true,
    paket: "P3",
  },
  {
    etiket: "Öğrenciler",
    yol: "/koordinator/ogrenciler",
    hazir: true,
    paket: "P5",
  },
  {
    etiket: "Öğrenci kayıtları",
    yol: "/koordinator/kayitlar",
    hazir: true,
    paket: "P6",
  },
  {
    etiket: "Stajyerler",
    yol: "/koordinator/stajyerler",
    hazir: true,
    paket: "P6",
  },
  {
    etiket: "Stajyer atamaları",
    yol: "/koordinator/atamalar",
    hazir: true,
    paket: "P6",
  },
  {
    etiket: "Puanlamalar",
    yol: "/koordinator/puanlamalar",
    hazir: true,
    paket: "P7",
  },
  { etiket: "Raporlar", yol: "/koordinator/raporlar", hazir: false, paket: "P9" },
  { etiket: "Arşiv", yol: "/koordinator/arsiv", hazir: false, paket: "P11" },
];

/** §12.3 — Stajyer panelinin ekranları. */
export const STAJYER_MENUSU: readonly MenuOgesi[] = [
  { etiket: "Görevlerim", yol: "/stajyer", hazir: true, paket: "P2" },
  {
    etiket: "Öğrencilerim",
    yol: "/stajyer/ogrencilerim",
    hazir: true,
    paket: "P7",
  },
  {
    etiket: "Doldurduğum formlar",
    yol: "/stajyer/formlarim",
    hazir: true,
    paket: "P7",
  },
];
