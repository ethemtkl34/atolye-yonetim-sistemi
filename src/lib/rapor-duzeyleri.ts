/**
 * Beceri düzeyi merdiveni — §11.
 *
 * Rapor, bir beceri kategorisinin puan ortalamasını beş basamaklı bir
 * DAVRANIŞ merdivenine çevirir. Merdivenin söylediği şey "kaç puan aldı"
 * değil, "bu davranışı ne kadar destekle gerçekleştirdi": en alt basamak
 * yetişkin yardımıyla, en üst basamak tutarlı ve kendiliğinden.
 *
 * KIYASLAMASIZ. Kademe motorundan (`rapor-bantlari.ts`) farkı burada:
 * orada gelişim alanı grup ortalamasıyla karşılaştırılıyordu, burada
 * karşılaştırma yok. Bir çocuğun davranışı, grubun o hafta nasıl olduğuna
 * göre değişmemeli.
 *
 * BEŞ BASAMAK, ÇÜNKÜ ÖLÇEK BEŞLİK. Puanlama formu 1–5 ve kurumun kendi
 * açıklaması "1: Desteklenmeli, 5: İleri Düzey" diyor; merdivenin uçları
 * bilerek o iki adla aynı tutuldu.
 *
 * "GÖZLENMEDİ" DİYE BİR BASAMAK YOK. Puanı olmayan kategori için düşük bir
 * düzey uydurmak yerine `null` döner ve rapor o kartı hiç basmaz. Katılım
 * sağlanmayan oturumlar zaten hiçbir ortalamaya girmiyor (§13.12,
 * `atolyeOzetiHesapla`), yani devamsızlık bir çocuğu aşağı çekmez.
 *
 * ERİŞİLEBİLİRLİK: düzey İKİ kanaldan anlatılır — renk ve küre çapı. Renk
 * körlüğü olan bir okuyucu da, gri basılmış bir çıktı da düzeyi boyuttan ve
 * her zaman yazılan etiketten okuyabilir.
 *
 * Bütün fonksiyonlar saf: veritabanı bilmezler, tarih üretmezler.
 */

export type Duzey =
  | "DESTEKLENMELI"
  | "GELISIYOR"
  | "BAGIMSIZ"
  | "BELIRGIN"
  | "ILERI";

export type DuzeyBilgisi = {
  duzey: Duzey;
  /** 1–5 ölçeğindeki basamak; merdivenin sırasını da verir. */
  basamak: 1 | 2 | 3 | 4 | 5;
  /** Rapora basılan kısa ad — kürenin içine yazılır. */
  etiket: string;
  /** Aileye açıklama; rehber sayfasında bu satır basılır. */
  aciklama: string;
  /** Küre çapı (pt) — rengin yanındaki ikinci kanal. */
  cap: number;
  /** Küre gradyanının açıktan koyuya üç durağı. */
  acik: string;
  orta: string;
  koyu: string;
  /**
   * Kürenin İÇİNE yazılan etiketin rengi.
   *
   * Hepsinde beyaz olamıyor: altın küre üstünde beyaz yazının kontrastı
   * 2:1'in altına düşüyor ve okunmuyor. Açık zeminli basamak koyu yazı alır.
   */
  icMetin: string;
};

/**
 * Merdivenin tek tanımı. Etiket metnini yumuşatmak isteyen buraya dokunur;
 * eşikler ve renkler etkilenmez.
 */
export const DUZEYLER: Record<Duzey, DuzeyBilgisi> = {
  DESTEKLENMELI: {
    duzey: "DESTEKLENMELI",
    basamak: 1,
    etiket: "Destekle",
    aciklama:
      "Yönerge, hatırlatma veya yetişkin yardımıyla gerçekleştirdi.",
    cap: 20,
    acik: "#ff9e8e",
    orta: "#d81e10",
    koyu: "#8f0e05",
    icMetin: "#ffffff",
  },
  GELISIYOR: {
    duzey: "GELISIYOR",
    basamak: 2,
    etiket: "Gelişiyor",
    aciklama: "Zaman zaman, kısmi destekle gerçekleştirdi.",
    cap: 24,
    acik: "#ffc08a",
    orta: "#e8590c",
    koyu: "#9a3a05",
    icMetin: "#ffffff",
  },
  BAGIMSIZ: {
    duzey: "BAGIMSIZ",
    basamak: 3,
    etiket: "Bağımsız",
    aciklama: "Yetişkin yardımı olmadan gerçekleştirdi.",
    cap: 28,
    acik: "#ffdf8a",
    orta: "#eda800",
    koyu: "#a86f00",
    icMetin: "#4a3200",
  },
  BELIRGIN: {
    duzey: "BELIRGIN",
    basamak: 4,
    etiket: "Belirgin",
    aciklama: "Farklı durumlarda kendiliğinden ve sık biçimde sergiledi.",
    cap: 32,
    acik: "#93c5fd",
    orta: "#2563eb",
    koyu: "#1e40af",
    icMetin: "#ffffff",
  },
  ILERI: {
    duzey: "ILERI",
    basamak: 5,
    etiket: "İleri düzey",
    aciklama:
      "Tutarlı biçimde sergiledi; akranlarına örnek olacak düzeyde kullandı.",
    cap: 36,
    acik: "#8fe39a",
    orta: "#1f9d3a",
    koyu: "#0d6b22",
    icMetin: "#ffffff",
  },
};

/** Merdiven sırası — rehber sayfası ve düzey rayı bu diziyi basar. */
export const DUZEY_MERDIVENI: readonly DuzeyBilgisi[] = [
  DUZEYLER.DESTEKLENMELI,
  DUZEYLER.GELISIYOR,
  DUZEYLER.BAGIMSIZ,
  DUZEYLER.BELIRGIN,
  DUZEYLER.ILERI,
];

/**
 * Bir ortalamayı düzeye çevirir.
 *
 * Kural en yakın tam basamağa yuvarlamak: 3,4 → "Bağımsız", 3,5 → "Belirgin".
 * Eşik listesi yerine yuvarlama seçildi çünkü veliye anlatılabilir olması
 * gerekiyor — "ortalaman hangi basamağa en yakınsa o" tek cümleyle
 * açıklanıyor.
 *
 * Puan yoksa `null`: uydurulmuş bir düzey basmaktansa kart hiç basılmaz.
 * Ölçek dışı değerler (bozuk veri) uçlara kırpılır.
 */
export function duzeyCikar(ortalama: number | null): DuzeyBilgisi | null {
  if (ortalama === null || Number.isNaN(ortalama)) return null;

  const basamak = Math.min(5, Math.max(1, Math.round(ortalama)));
  return DUZEY_MERDIVENI[basamak - 1];
}

/** İki düzey arasındaki değişim — "3. düzey → 4. düzey" oku için. */
export function duzeyDegisimi(
  baslangic: DuzeyBilgisi | null,
  son: DuzeyBilgisi | null,
): "YUKSELDI" | "GERILEDI" | "AYNI" | null {
  if (!baslangic || !son) return null;
  if (son.basamak > baslangic.basamak) return "YUKSELDI";
  if (son.basamak < baslangic.basamak) return "GERILEDI";
  return "AYNI";
}
