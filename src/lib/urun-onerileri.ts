import {
  beceriEtiketiCikar,
  type BeceriEtiketi,
  type GelisimAlani,
} from "./beceri-etiketleri";

/**
 * Ev önerileri için ürün seçimi — §11.2.
 *
 * NEDEN KURAL MOTORU: bu bölüm veliye gidiyor ve içinde ürün adı geçiyor.
 * Seçimi yapay zekâya bıraksaydık iki şey olurdu — var olmayan bir ürün adı
 * uydurabilir, ya da katalogdaki yanıltıcı etiketlere kanabilirdi. (Zetzeka
 * kataloğunda "Sosyal-Duygusal Gelişim" ifadesi 23 oyunun 20'sinde aynı
 * kalıp metin olarak geçiyor; oyunun çok oyunculu olmasından geliyor.)
 *
 * Bu yüzden ürünü sistem seçer, yapay zekâ yalnızca seçilenlerin etrafına
 * cümleyi yazar ve "listede yoksa ürün adı verme" talimatı alır.
 *
 * Fonksiyonlar saf: veritabanı bilmezler, aday listesi dışarıdan verilir.
 */

export type OneriAdayi = {
  id: string;
  ad: string;
  url: string;
  kategori: string;
  yasMin: number;
  yasMax: number;
  alanlar: string[];
  beceriler: string[];
  /** Ürün bir atölyeyle birebir ilişkiliyse o atölyenin kimliği. */
  workshopTypeId: string | null;
};

export type OneriIstegi = {
  /** Öğrencinin tam yaşı. Bilinmiyorsa yaş süzgeci uygulanamaz. */
  yas: number | null;
  /** Desteklenmesi önerilen alanların başlıkları (soru/beceri adları). */
  desteklenecekBasliklar: readonly string[];
  /** Öne çıkan alanların başlıkları — güçlü yön de beslenebilir. */
  gucluBasliklar: readonly string[];
  /** Öğrencinin ilgisi en yüksek atölyelerin kimlikleri, sıralı. */
  ilgiliAtolyeIdleri: readonly string[];
};

export type SecilenOneri = {
  urun: OneriAdayi;
  /** Neden seçildiği — metin katmanına gerekçe olarak verilir. */
  gerekce: "ATOLYE_BAGI" | "DESTEKLENECEK_ALAN" | "GUCLU_ALAN";
  eslesenBeceri: BeceriEtiketi;
};

/** Bir raporda en fazla kaç ürün önerilir. */
const EN_FAZLA_ONERI = 3;

/**
 * Başlık listesini beceri etiketlerine indirger; sıra korunur, tekrar atılır.
 */
function etiketleriCikar(basliklar: readonly string[]): BeceriEtiketi[] {
  const etiketler: BeceriEtiketi[] = [];
  for (const baslik of basliklar) {
    const etiket = beceriEtiketiCikar(baslik);
    if (etiket && !etiketler.includes(etiket)) etiketler.push(etiket);
  }
  return etiketler;
}

function yasaUygun(urun: OneriAdayi, yas: number | null): boolean {
  // Yaş bilinmiyorsa süzemeyiz. Ürünü elemek yerine geçiriyoruz: yaş alanı
  // öğrenci kaydında isteğe bağlı ve boş olması öneri üretmemek için yeterli
  // bir gerekçe değil. Koordinatör metni zaten onaylayacak.
  if (yas === null) return true;
  return yas >= urun.yasMin && yas <= urun.yasMax;
}

/**
 * §11.2 — Öğrenciye uygun ürünleri sıralar.
 *
 * Öncelik sırası bilinçli:
 *   1. Atölye bağı — öğrencinin ilgi duyduğu atölyede zaten oynanan oyunun
 *      ev versiyonu. En somut ve en ikna edici öneri; veli çocuğun neyden
 *      hoşlandığını bu sayede tanıyor.
 *   2. Desteklenecek alan — gelişim ihtiyacına doğrudan karşılık.
 *   3. Güçlü alan — mevcut ilgiyi derinleştiren öneri.
 *
 * Aynı ürün iki kez önerilmez; her beceri için en fazla bir ürün seçilir ki
 * liste tek bir konuya yığılmasın.
 *
 * BOŞ DÖNEBİLİR ve bu normaldir: katalogda 8 yaş üstü için duygusal beceri
 * ürünü yok. Bu durumda metin katmanı ürün adı vermeden genel öneri yazar.
 */
export function urunOnerileriSec(
  adaylar: readonly OneriAdayi[],
  istek: OneriIstegi,
): SecilenOneri[] {
  const uygunlar = adaylar.filter((urun) => yasaUygun(urun, istek.yas));

  const secilenler: SecilenOneri[] = [];
  const kullanilanUrunler = new Set<string>();
  const kullanilanBeceriler = new Set<BeceriEtiketi>();

  function ekle(
    urun: OneriAdayi,
    gerekce: SecilenOneri["gerekce"],
    beceri: BeceriEtiketi,
  ): boolean {
    if (secilenler.length >= EN_FAZLA_ONERI) return false;
    if (kullanilanUrunler.has(urun.id)) return false;
    if (kullanilanBeceriler.has(beceri)) return false;

    secilenler.push({ urun, gerekce, eslesenBeceri: beceri });
    kullanilanUrunler.add(urun.id);
    kullanilanBeceriler.add(beceri);
    return true;
  }

  // 1. Atölye bağı — ilgi sırasına göre.
  for (const atolyeId of istek.ilgiliAtolyeIdleri) {
    if (secilenler.length >= EN_FAZLA_ONERI) break;

    const urun = uygunlar.find(
      (aday) =>
        aday.workshopTypeId === atolyeId && !kullanilanUrunler.has(aday.id),
    );
    if (!urun) continue;

    const beceri = urun.beceriler.find(
      (b): b is BeceriEtiketi =>
        !kullanilanBeceriler.has(b as BeceriEtiketi),
    );
    if (beceri) ekle(urun, "ATOLYE_BAGI", beceri);
  }

  // 2. Desteklenecek alanlar, 3. güçlü alanlar.
  const siralar: [readonly string[], SecilenOneri["gerekce"]][] = [
    [istek.desteklenecekBasliklar, "DESTEKLENECEK_ALAN"],
    [istek.gucluBasliklar, "GUCLU_ALAN"],
  ];

  for (const [basliklar, gerekce] of siralar) {
    for (const beceri of etiketleriCikar(basliklar)) {
      if (secilenler.length >= EN_FAZLA_ONERI) break;
      if (kullanilanBeceriler.has(beceri)) continue;

      const urun = uygunlar.find(
        (aday) =>
          aday.beceriler.includes(beceri) && !kullanilanUrunler.has(aday.id),
      );
      if (urun) ekle(urun, gerekce, beceri);
    }
  }

  return secilenler;
}

/**
 * Bir gelişim alanı için hiç uygun ürün bulunmadığında metin katmanına
 * verilecek bilgi: hangi alanda öneri yapılamadığı.
 *
 * Örnek raporda kitap önerisi bir SERİ ve TEMA söylüyor, ürün adı vermiyor
 * ("Sosyal-Duygusal Destek Kitapları arasından paylaşma temalı hikâyeler").
 * Katalogda yaşa uygun ürün olmadığında aynı yol izlenir — seri ve tema
 * söylenir, ad uydurulmaz.
 */
export function urunsuzAlanlar(
  secilenler: readonly SecilenOneri[],
  istenenAlanlar: readonly GelisimAlani[],
): GelisimAlani[] {
  const karsilananlar = new Set(
    secilenler.flatMap((secim) => secim.urun.alanlar),
  );
  return istenenAlanlar.filter((alan) => !karsilananlar.has(alan));
}

/**
 * Bir beceri etiketi için yaşa uygun ürünler — veli görüşmesi formu kullanır.
 *
 * `urunOnerileriSec`ten AYRI çünkü oradaki kurallar rapora ait: en fazla üç
 * ürün, beceri başına bir tane, öncelik sırası atölye bağı → desteklenecek →
 * güçlü alan. Görüşme formunda uzman beş alan işaretleyebilir ve her biri
 * için somut ürün görmek ister; raporun üç ürünlük bütçesi burada yanlış
 * kısıt olurdu.
 *
 * Sıra katalog sırasıdır (rastgelelik yok): aynı seçim her açılışta aynı
 * ürünleri gösterir.
 */
export function beceriyeGoreUrunler(
  adaylar: readonly OneriAdayi[],
  etiket: BeceriEtiketi,
  yas: number | null,
  enFazla = 2,
): OneriAdayi[] {
  return adaylar
    .filter((urun) => urun.beceriler.includes(etiket) && yasaUygun(urun, yas))
    .slice(0, enFazla);
}
