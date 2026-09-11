/**
 * §17.3 — Uzman renk paleti.
 *
 * Takvimde bir günde yan yana duran seansları uzmana göre ayırt etmeye
 * yarıyor. Renk SERBEST HEX DEĞİL, bu listeden bir anahtar; üç gerekçe:
 *
 * 1. Tasarım dilinde (docs/TASARIM-DILI.md 3. kural) anlam renkleri ayrılmış
 *    durumda — emerald "olumlu", red "hata", vurgu "uyarı" demek. Serbest hex
 *    seçilseydi bir uzmanın rengi takvimde "iptal edilmiş" gibi okunurdu.
 * 2. Ayırt edilebilirliğin pratik sınırı var; liste uzadıkça yeni girdiler
 *    kullanıcıya ayrım sağlamaz, yalnız benzer tonlar üretir.
 * 3. Kontrast bir kez burada ayarlanıyor; her ekran kendi tonunu hesaplamıyor.
 *
 * SIRA ÖNEMLİ: kurumsal palet (marka kılavuzundaki sekiz renk) başta, genel
 * palet arkasında. `siradakiUzmanRengi` listeyi baştan tarar — yeni uzman
 * önce kurum rengini alsın diye.
 *
 * ÜÇ ALAN, ÜÇ FARKLI İŞ:
 * - `blok`: takvimdeki dolu bloğun ve renk noktalarının rengi. KİMLİK rengi
 *   budur; kurumsal girdilerde marka kılavuzundaki hex'in ta kendisi.
 * - `metin`: AÇIK zemin (ya da beyaz kart) üstünde okunan koyu ton. Marka
 *   renklerinin bir kısmı yazı olarak okunmuyor (#6bc4ca beyaz üstünde
 *   ~1.9:1), bu yüzden aynı ailenin koyulaştırılmış tonu yazılı.
 * - `zemin`: çip ve Program görünümünün açık dolgusu.
 *
 * Bloğun ÜSTÜNDEKİ yazı rengi sabit değil, `blokYazisi()` ile parlaklıktan
 * hesaplanıyor: kurumsal paletteki açık tonlarda (sarı, yeşil, turkuaz)
 * beyaz yazı okunmazdı.
 *
 * Palet renk körlüğü için TEK BAŞINA yeterli değil: takvimde renk yanında
 * her zaman uzmanın adı da yazılır, renk yalnız hızlı tarama içindir.
 */

export const UZMAN_RENKLERI = [
  // Kurumsal palet — TÜZDER marka kılavuzu.
  { anahtar: "kurum-turuncu", etiket: "Kurum turuncusu", zemin: "#fde3d8", metin: "#a5330d", blok: "#e94d1a" },
  { anahtar: "kurum-kirmizi", etiket: "Kurum kırmızısı", zemin: "#fcdce7", metin: "#a80840", blok: "#d70b52" },
  { anahtar: "kurum-sari", etiket: "Kurum sarısı", zemin: "#fdecd0", metin: "#9a5c00", blok: "#f29100" },
  { anahtar: "kurum-yesil", etiket: "Kurum yeşili", zemin: "#ecf3d6", metin: "#5c7014", blok: "#94b422" },
  { anahtar: "kurum-turkuaz", etiket: "Kurum turkuazı", zemin: "#e0f4f5", metin: "#276e73", blok: "#6bc4ca" },
  { anahtar: "kurum-mor", etiket: "Kurum moru", zemin: "#f7dee9", metin: "#a3185b", blok: "#a3185b" },
  { anahtar: "kurum-siyah", etiket: "Kurum siyahı", zemin: "#dcdcdf", metin: "#000000", blok: "#000000" },
  { anahtar: "kurum-mavi", etiket: "Kurum mavisi", zemin: "#d6eff4", metin: "#006b7d", blok: "#009bb4" },

  // Genel palet — kurum renkleri tükendiğinde ayrım sürsün diye.
  { anahtar: "mavi", etiket: "Mavi", zemin: "#dbeafe", metin: "#1e40af", blok: "#1e40af" },
  { anahtar: "mor", etiket: "Mor", zemin: "#ede9fe", metin: "#5b21b6", blok: "#5b21b6" },
  { anahtar: "camgobegi", etiket: "Camgöbeği", zemin: "#cffafe", metin: "#155e75", blok: "#155e75" },
  { anahtar: "lacivert", etiket: "Lacivert", zemin: "#e0e7ff", metin: "#3730a3", blok: "#3730a3" },
  { anahtar: "pembe", etiket: "Pembe", zemin: "#fce7f3", metin: "#9d174d", blok: "#9d174d" },
  { anahtar: "turuncu", etiket: "Turuncu", zemin: "#ffedd5", metin: "#9a3412", blok: "#9a3412" },
  { anahtar: "kahve", etiket: "Kahve", zemin: "#f5e6d8", metin: "#78350f", blok: "#78350f" },
  { anahtar: "gri", etiket: "Gri", zemin: "#e4e4e7", metin: "#3f3f46", blok: "#3f3f46" },
  { anahtar: "eflatun", etiket: "Eflatun", zemin: "#f3e8ff", metin: "#6b21a8", blok: "#6b21a8" },
  { anahtar: "denizmavisi", etiket: "Deniz mavisi", zemin: "#cce7f0", metin: "#0c4a6e", blok: "#0c4a6e" },
  { anahtar: "bordo", etiket: "Bordo", zemin: "#f3dede", metin: "#7f1d1d", blok: "#7f1d1d" },
  { anahtar: "haki", etiket: "Haki", zemin: "#e7e9d5", metin: "#4d5c1f", blok: "#4d5c1f" },
] as const;

export type UzmanRengi = (typeof UZMAN_RENKLERI)[number]["anahtar"];

const RENK_HARITASI = Object.fromEntries(
  UZMAN_RENKLERI.map((renk) => [renk.anahtar, renk]),
) as Record<UzmanRengi, (typeof UZMAN_RENKLERI)[number]>;

export function uzmanRengiMi(deger: unknown): deger is UzmanRengi {
  return (
    typeof deger === "string" &&
    Object.prototype.hasOwnProperty.call(RENK_HARITASI, deger)
  );
}

/**
 * Kayıttaki renk anahtarının görsel karşılığı.
 *
 * Bilinmeyen anahtar (palet küçültülmüş, kayıt eski) hata vermez, ilk rengi
 * döner: bir uzmanın rengi yüzünden takvimin çizilmemesi kabul edilemez.
 */
export function uzmanRengi(anahtar: string) {
  return RENK_HARITASI[anahtar as UzmanRengi] ?? UZMAN_RENKLERI[0];
}

/** Tek kanalın WCAG'e göre doğrusallaştırılmış değeri. */
function kanal(sekizBit: number): number {
  const oran = sekizBit / 255;
  return oran <= 0.03928 ? oran / 12.92 : ((oran + 0.055) / 1.055) ** 2.4;
}

/** `#rrggbb` renginin göreli parlaklığı (WCAG 2.1). */
function parlaklik(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

/**
 * Dolu bir rengin ÜSTÜNDE okunacak yazı rengi.
 *
 * Takvim bloğu eskiden sabit beyaz yazı kullanıyordu; genel paletin tonları
 * yeterince koyu olduğu için bu sorun değildi. Kurumsal palet gelince
 * bozuldu: #f29100 (sarı), #94b422 (yeşil) ve #6bc4ca (turkuaz) üstünde
 * beyaz yazının kontrastı 2:1 civarına düşüyor, yani okunmuyor. Eşik 0.18,
 * WCAG'in beyaz/siyah dönüm noktası — iki yönde de en az 4.5:1 tutuyor.
 */
export function blokYazisi(blok: string): string {
  return parlaklik(blok) > 0.18 ? "#18181b" : "#ffffff";
}

/**
 * Yeni uzman için sırada olan renk — kullanılmayanlardan ilki.
 *
 * Hepsi kullanılmışsa başa dönülür; paletten fazla uzmanda renk tekrarı
 * kaçınılmaz ve iki uzmanın aynı rengi paylaşması, hiç renk olmamasından iyi.
 */
export function siradakiUzmanRengi(
  kullanilanlar: readonly string[],
): UzmanRengi {
  const kullanilan = new Set(kullanilanlar);
  const bos = UZMAN_RENKLERI.find((renk) => !kullanilan.has(renk.anahtar));
  return (bos ?? UZMAN_RENKLERI[kullanilanlar.length % UZMAN_RENKLERI.length])
    .anahtar;
}
