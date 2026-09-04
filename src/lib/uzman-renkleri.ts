/**
 * §17.3 — Uzman renk paleti.
 *
 * Takvimde bir günde yan yana duran seansları uzmana göre ayırt etmeye
 * yarıyor. Renk SERBEST HEX DEĞİL, bu listeden bir anahtar; üç gerekçe:
 *
 * 1. Tasarım dilinde (docs/TASARIM-DILI.md 3. kural) anlam renkleri ayrılmış
 *    durumda — emerald "olumlu", red "hata", vurgu "uyarı" demek. Serbest hex
 *    seçilseydi bir uzmanın rengi takvimde "iptal edilmiş" gibi okunurdu.
 *    Bu yüzden palet o üç aileden UZAK tonlardan kuruldu.
 * 2. On iki renk ayırt edilebilirliğin pratik sınırı. Daha fazlası kullanıcıya
 *    ayrım sağlamaz, yalnız benzer tonlar üretir.
 * 3. Kontrast bir kez burada ayarlanıyor; her ekran kendi tonunu hesaplamıyor.
 *
 * Palet renk körlüğü için TEK BAŞINA yeterli değil: takvimde renk yanında
 * her zaman uzmanın adı da yazılır, renk yalnız hızlı tarama içindir.
 */

export const UZMAN_RENKLERI = [
  { anahtar: "mavi", etiket: "Mavi", zemin: "#dbeafe", metin: "#1e40af" },
  { anahtar: "mor", etiket: "Mor", zemin: "#ede9fe", metin: "#5b21b6" },
  { anahtar: "camgobegi", etiket: "Camgöbeği", zemin: "#cffafe", metin: "#155e75" },
  { anahtar: "lacivert", etiket: "Lacivert", zemin: "#e0e7ff", metin: "#3730a3" },
  { anahtar: "pembe", etiket: "Pembe", zemin: "#fce7f3", metin: "#9d174d" },
  { anahtar: "turuncu", etiket: "Turuncu", zemin: "#ffedd5", metin: "#9a3412" },
  { anahtar: "kahve", etiket: "Kahve", zemin: "#f5e6d8", metin: "#78350f" },
  { anahtar: "gri", etiket: "Gri", zemin: "#e4e4e7", metin: "#3f3f46" },
  { anahtar: "eflatun", etiket: "Eflatun", zemin: "#f3e8ff", metin: "#6b21a8" },
  { anahtar: "denizmavisi", etiket: "Deniz mavisi", zemin: "#cce7f0", metin: "#0c4a6e" },
  { anahtar: "bordo", etiket: "Bordo", zemin: "#f3dede", metin: "#7f1d1d" },
  { anahtar: "haki", etiket: "Haki", zemin: "#e7e9d5", metin: "#4d5c1f" },
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

/**
 * Yeni uzman için sırada olan renk — kullanılmayanlardan ilki.
 *
 * Hepsi kullanılmışsa başa dönülür; on ikiden fazla uzmanda renk tekrarı
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
