/**
 * §17.2 — Hizmet kataloğu başlangıç verisi.
 *
 * İki yerden okunuyor: `seed.ts` (taze kurulum) ve `hizmet-katalogu-tohum.ts`
 * (mevcut bir veritabanına katalogu yazmak / tazelemek). Liste tek yerde
 * durmalı — iki kopya olsaydı biri güncellenip diğeri unutulurdu.
 *
 * Fiyatlar ve süreler kurumun 2026 fiyat listesinden. Ücret KURUŞ cinsinden
 * tamsayı: ₺3.200,00 = 320000.
 *
 * Liste iki kaynağın birleşimidir:
 *  - Kurumun güncel fiyat listesi (dört zekâ testi + altı danışmanlık).
 *  - Mevcut `TherapyType` enum'ının değerleri. "Ergoterapi" fiyat listesinde
 *    yok ama canlıda ona bağlı görüşme kayıtları var; katalogda karşılığı
 *    olmasaydı o kayıtların hizmeti adsız kalırdı. Fiyat listesindeki
 *    karşılığı olan "Duyu Bütünleme Programı" ile AYNI ŞEY OLUP OLMADIĞI
 *    kuruma soruldu ve ayrı hizmet oldukları teyit edilmedi — ikisi de
 *    katalogda duruyor, kurum gerekmeyeni panelden pasife alabilir.
 *
 * Katalog buradan sonra PANELDEN yönetilir; seed yalnızca adı, grubu ve
 * sırayı tazeler. Fiyat ve süre `update` kapsamında DEĞİL: kurum panelden
 * zam yaptıktan sonra seed'in tekrar çalışması onu geri almamalı.
 */
export const HIZMETLER: {
  ad: string;
  grup: "TEST" | "DANISMANLIK" | "ATOLYE";
  sureDk: number;
  ucretKurus: number;
  yasAlt?: number;
  yasUst?: number;
  tekrarli?: boolean;
  danisanTuru?: "COCUK" | "VELI";
}[] = [
  // Zekâ testleri — tek seferlik, otomatik tekrar kapsamı dışında.
  { ad: "WISC-IV", grup: "TEST", sureDk: 120, ucretKurus: 780000, yasAlt: 6, yasUst: 16 },
  { ad: "CAS", grup: "TEST", sureDk: 120, ucretKurus: 780000, yasAlt: 5, yasUst: 17 },
  { ad: "ST. Binet", grup: "TEST", sureDk: 120, ucretKurus: 780000, yasAlt: 2, yasUst: 5 },
  { ad: "Denver", grup: "TEST", sureDk: 90, ucretKurus: 680000, yasAlt: 0, yasUst: 3 },

  // Danışmanlıklar — haftalık tekrara açık.
  { ad: "Oyun Temelli Danışmanlık", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 74, tekrarli: true },
  { ad: "Ergen Danışmanlığı", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 74, tekrarli: true },
  { ad: "Bilişsel Müdahale", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 74, tekrarli: true },
  { ad: "Duyu Bütünleme Programı", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 18, tekrarli: true },
  { ad: "Ergoterapi", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 18, tekrarli: true },
  // Aile danışmanlığında danışan velinin KENDİSİ; seansa çocuk girmiyor.
  { ad: "Kısa Aile Danışmanlığı", grup: "DANISMANLIK", sureDk: 60, ucretKurus: 320000, yasAlt: 0, yasUst: 17, tekrarli: true, danisanTuru: "VELI" },
  { ad: "Uzun Aile Danışmanlığı", grup: "DANISMANLIK", sureDk: 90, ucretKurus: 320000, yasAlt: 0, yasUst: 17, tekrarli: true, danisanTuru: "VELI" },

  // Atölye görüşmesi — ücretsiz.
  { ad: "Atölye Görüşmesi", grup: "ATOLYE", sureDk: 30, ucretKurus: 0, danisanTuru: "VELI" },
];

