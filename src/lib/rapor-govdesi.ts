import {
  asimetriBul,
  atolyeBandi,
  gelisimBandi,
  gelisimCumlesi,
  gelisimDegisimi,
  VARSAYILAN_ESIKLER,
  type Asimetri,
  type BantBilgisi,
  type GelisimDegisimi,
  type Kademe,
  type RaporEsikleri,
} from "./rapor-bantlari";
import { kategoriOrtalamalari } from "./puan-hesaplari";
import type { SoruOrtalamasi } from "./puan-hesaplari";

/**
 * Raporun ikinci sürüm gövdesi — §11.2.
 *
 * BİRİNCİ SÜRÜMDEN FARKI: rapor artık veliye ham puan göstermiyor. Soru
 * bazlı ortalama listesi kalktı; yerine üç şey geldi — atölyenin dönem
 * boyunca ne işlediğini anlatan paragraf, kademe göstergeleri ve eğitmen
 * gözlemi.
 *
 * ESKİ RAPORLAR BOZULMAZ: gövde `surum` alanı taşıyor ve okuyan taraflar
 * (PDF, pencere) iki biçimi de tanıyor. Üretilmiş bir raporun içeriği
 * sonradan değişmemeli — PDF'i alınmış bir rapor, alındığı günkü hâlini
 * göstermeye devam etmeli (§13.17).
 */

export type KademeSatiri = {
  /** "Duygusal Gelişim Alanları" ya da atölye adı. */
  ad: string;
  bant: BantBilgisi | null;
};

export type GelisimAlaniSatiri = KademeSatiri & {
  /** Bu alanda değerlendirilen kazanım başlıkları — raporda listelenir. */
  kazanimlar: string[];
  /** Puan bandından üretilen değerlendirme cümlesi. */
  cumle: string | null;
  /** 5'lik grafik için ham ortalamalar. Eski snapshot'larda yok; PDF o
   *  durumda kademe eksenli grafiğe düşer. */
  ogrenciOrtalamasi?: number | null;
  grupOrtalamasi?: number | null;
  /**
   * Aynı öğrencinin DÖNEM ORTASI ölçümü. Stajyer 18 soruluk formu dönemde
   * iki kez dolduruyor; rapor uzun süre yalnızca ikincisini okudu. Dönem
   * ortası formu doldurulmamışsa ve eski snapshot'larda yok — grafiğe üçüncü
   * çubuk o durumda hiç çizilmez.
   */
  ortaOrtalamasi?: number | null;
  /** İki ölçüm arasındaki değişimin veliye yazılan yorumu. */
  degisim?: GelisimDegisimi | null;
};

export type AtolyeKademesi = {
  atolyeAdi: string;
  /** "İlgi ve Merak Alanları" ortalamasının kademesi. */
  ilgi: BantBilgisi | null;
  /** "Yetenek Gelişim Alanları" ortalamasının kademesi. */
  basari: BantBilgisi | null;
  /** 5'lik grafik için ham ortalamalar (eski snapshot'larda yok). */
  ilgiOrtalamasi?: number | null;
  basariOrtalamasi?: number | null;
  katildigiOturumSayisi: number;
  katilmadigiOturumSayisi: number;
  /** Öğrenciye özel, puanlamalardan kural tabanlı üretilen atölye paragrafı.
   *  Eski snapshot'larda yok; PDF o durumda grafik eksenli eski atölye
   *  sayfalarına düşer. */
  metin?: string | null;
};

export type BeceriBlogu = {
  beceriAdi: string;
  /** Sabit sözlük tanımı. */
  tanim: string;
  /** Etkinliğin anlatımı — müfredattan. */
  etkinlik: string | null;
  /** Öğrenciye özel gözlem metni. */
  gozlem: string;
};

export type GozlemBolumu = {
  /** Dönemi tanıtan giriş paragrafı. */
  giris: string;
  /** Öğrencinin genel profili. */
  profil: string;
  bloklar: BeceriBlogu[];
  sonuc: string;
  /** Ev önerileri ve varsa kulüp yönlendirmesi. */
  oneriler: string;
  /** Önerilen ürünler — metinde ad geçiyorsa bağlantı da basılır. */
  urunler: { ad: string; url: string }[];
};

/**
 * §11.2 — Raporun eksik üretilen bir bölümü ve sebebi.
 *
 * Rapor, eksik veriyle de üretilebilir: gelişim değerlendirmesi girilmemişse
 * kademe çıkmaz, gözlem notu yoksa gözlem bölümü yazılmaz. Bu durumlar
 * SESSİZ KALMAMALI — koordinatör "bölüm neden yok" diye kodu okumak zorunda
 * kalmasın diye sebep ve çözüm rapora yazılır.
 *
 * Uyarılar yalnızca panelde görünür; veliye giden PDF'e basılmaz.
 */
export type RaporUyarisi = {
  /** Etkilenen bölüm — arayüz gruplamak isterse. */
  bolum: "gozlem" | "atolyeIcerik" | "gelisim" | "kademe";
  /** Neyin üretilemediği. */
  mesaj: string;
  /** Bunu gidermek için ne yapılmalı. */
  cozum: string;
};

export type RaporGovdesiV2 = {
  surum: 2;
  ogrenci: {
    adSoyad: string;
    ilkAd: string;
    sinif: string | null;
  };
  egitimYili: string | null;
  /** Kapağın alt satırı için şube adı. Eski snapshot'larda yok; PDF o
   *  durumda grup adına düşer. */
  subeAdi?: string | null;
  /** "Bu raporlamada ... değerlendirilen grubun öğrenci sayısı" notu için;
   *  kıyas grubundaki dönem sonu değerlendirmesi girilmiş öğrenci sayısı.
   *  Eski snapshot'larda yok; satır o durumda basılmaz. */
  grupOgrenciSayisi?: number | null;
  kapsam: { programAdi: string; grupAdi: string; tur: "Dönem" | "Kulüp" }[];
  /** Program düzeyinde üretilen atölye içerik paragrafları. */
  atolyeIcerikleri: { atolyeAdi: string; metin: string }[];
  gelisimAlanlari: GelisimAlaniSatiri[];
  atolyeKademeleri: AtolyeKademesi[];
  asimetriler: Asimetri[];
  gozlem: GozlemBolumu | null;
  /** Üretilemeyen bölümler ve sebepleri; eski snapshot'larda yok. */
  uyarilar?: RaporUyarisi[];
  /**
   * Üretim anında geçerli olan kademe adları.
   *
   * Kademe skalası üç adı da basar (seçili olan ve olmayanlar); seçili
   * olmayanların adı gövdedeki `bant` alanlarından okunamaz. Etiketler
   * panelden değiştirilebildiği için canlı tablodan okumak, alınmış bir
   * belgenin skalasını sonradan değiştirirdi (§13.17). Eski snapshot'larda
   * yok; okuyan taraf o durumda koddaki varsayılan adlara düşer.
   */
  kademeEtiketleri?: Record<Kademe, string>;
  /** Metnin nasıl üretildiği — denetlenebilirlik için saklanır. */
  metinKaynagi: "sablon" | "ai";
};

// ---------------------------------------------------------------------------
// Kademe çıkarımı
// ---------------------------------------------------------------------------

/**
 * Örnek raporun iki grafiği, atölye sorularının iki konu başlığına karşılık
 * geliyor. Eşleme metne göre yapılıyor çünkü başlıklar kurum tarafından
 * yazılıyor ve atölyeden atölyeye küçük farklarla yazılabiliyor.
 */
const ILGI_ANAHTARI = "ilgi";
const BASARI_ANAHTARI = "yetenek";

function kategoriBul(
  kategoriler: readonly { kategori: string; ortalama: number | null }[],
  anahtar: string,
): number | null {
  // KELİME eşleşmesi, alt-dize değil: "Bilgi ve Kavram Gelişimi" başlığı
  // içinde "ilgi" geçer (b-İLGİ) ve düz includes onu ilgi kategorisi sanıp
  // İlgi grafiğini yanlış sorulardan beslerdi. Kategori adı kelimelere
  // ayrılır; kelimelerden biri anahtarla BAŞLIYORSA ("ilgi", "ilgisi",
  // "yetenek", "yetenekleri"...) eşleşir.
  const bulunan = kategoriler.find((k) =>
    k.kategori
      .toLocaleLowerCase("tr-TR")
      .split(/[^a-zçğıiöşü]+/)
      .some((kelime) => kelime.startsWith(anahtar)),
  );
  return bulunan?.ortalama ?? null;
}

/**
 * §11.2 — Bir atölyenin ilgi ve başarı kademeleri.
 *
 * Bu iki ölçüm KIYASLANMAZ (örnek rapor: "akran grubu veya sınıf içi
 * kıyaslamayı kapsamamaktadır"), bu yüzden mutlak eşiklerle değerlendirilir.
 */
export function atolyeKademesiCikar(
  atolye: {
    atolyeAdi: string;
    soruOrtalamalari: readonly SoruOrtalamasi[];
    katildigiOturumSayisi: number;
    katilmadigiOturumSayisi: number;
  },
  esikler: RaporEsikleri = VARSAYILAN_ESIKLER,
): AtolyeKademesi {
  const kategoriler = kategoriOrtalamalari(atolye.soruOrtalamalari);
  const ilgiOrtalamasi = kategoriBul(kategoriler, ILGI_ANAHTARI);
  const basariOrtalamasi = kategoriBul(kategoriler, BASARI_ANAHTARI);

  return {
    atolyeAdi: atolye.atolyeAdi,
    ilgi: atolyeBandi(ilgiOrtalamasi, esikler),
    basari: atolyeBandi(basariOrtalamasi, esikler),
    // Ham ortalamalar 5'lik grafik için taşınır; kademe hesabı değişmez.
    ilgiOrtalamasi,
    basariOrtalamasi,
    katildigiOturumSayisi: atolye.katildigiOturumSayisi,
    katilmadigiOturumSayisi: atolye.katilmadigiOturumSayisi,
  };
}

/**
 * §11.2 — Atölye paragrafı: öğrencinin o atölyedeki durumunu velinin
 * okuyacağı dille anlatan, tamamen puanlamalardan türetilmiş metin.
 *
 * KURAL TABANLI ve deterministiktir — yapay zekâ yok, aynı puanlar hep aynı
 * cümleleri üretir; koordinatör metnin her cümlesinin hangi veriden
 * geldiğini bilebilir. Veliye ham puan gösterilmez: sayı yalnızca katılım
 * cümlesindeki oturum sayılarında geçer (örnek rapor da katılımı sayıyla
 * yazıyor), puan ortalamaları cümleye kademe diliyle çevrilir.
 */
/**
 * "8'ine", "6'sına", "10'una" — sayının okunuşuna uyan iyelik + yönelme eki.
 * Katılım cümleleri sabit "'ine" ekiyle yazılınca "10'ine katıldı" gibi ek
 * uyumu bozuk cümleler çıkıyordu (veli incelemesi bulgusu).
 */
export function oturumEki(sayi: number): string {
  const SON_RAKAM: Record<number, string> = {
    1: "'ine", 2: "'sine", 3: "'üne", 4: "'üne", 5: "'ine",
    6: "'sına", 7: "'sine", 8: "'ine", 9: "'una",
  };
  const ONLUK: Record<number, string> = {
    10: "'una", 20: "'sine", 30: "'una", 40: "'ına", 50: "'sine",
    60: "'ına", 70: "'ine", 80: "'ine", 90: "'ına",
  };
  const son = sayi % 10;
  if (son !== 0) return SON_RAKAM[son];
  return ONLUK[sayi % 100] ?? "'ine";
}

/** "43'ü", "2'si", "50'si" — sayının okunuşuna uyan yalın iyelik eki
 *  (Bir Bakışta katılım satırı gibi "N oturumun M'ü" kalıpları için). */
export function iyelikEki(sayi: number): string {
  const SON_RAKAM: Record<number, string> = {
    1: "'i", 2: "'si", 3: "'ü", 4: "'ü", 5: "'i",
    6: "'sı", 7: "'si", 8: "'i", 9: "'u",
  };
  const ONLUK: Record<number, string> = {
    10: "'u", 20: "'si", 30: "'u", 40: "'ı", 50: "'si",
    60: "'ı", 70: "'i", 80: "'i", 90: "'ı",
  };
  const son = sayi % 10;
  if (son !== 0) return SON_RAKAM[son];
  return ONLUK[sayi % 100] ?? "'i";
}

export function atolyeMetniUret(girdi: {
  ilkAd: string;
  soruOrtalamalari: readonly SoruOrtalamasi[];
  basari: BantBilgisi | null;
  katildigiOturumSayisi: number;
  katilmadigiOturumSayisi: number;
}): string | null {
  const toplam = girdi.katildigiOturumSayisi + girdi.katilmadigiOturumSayisi;
  if (toplam === 0) return null;

  // Hiç katılmamış: değerlendirme cümlesi kurulamaz, sebep açıkça yazılır.
  if (girdi.katildigiOturumSayisi === 0) {
    return (
      `${girdi.ilkAd}, bu atölyede değerlendirme kapsamındaki ${toplam} ` +
      "oturuma katılamadığı için atölye içi değerlendirme oluşmamıştır."
    );
  }

  // "Değerlendirme kapsamındaki": döneme geç katılan öğrencide kayıt öncesi
  // haftalar tabana girmez; "dönem boyunca yapılan 1 oturum" gibi yanıltıcı
  // bir sayım yerine taban açıkça adlandırılır (veli incelemesi bulgusu).
  const cumleler: string[] = [];
  cumleler.push(
    girdi.katildigiOturumSayisi === toplam
      ? `${girdi.ilkAd}, değerlendirme kapsamındaki ${toplam} oturumun tamamına katılmıştır.`
      : `${girdi.ilkAd}, değerlendirme kapsamındaki ${toplam} oturumun ${girdi.katildigiOturumSayisi}${oturumEki(girdi.katildigiOturumSayisi)} katılmıştır.`,
  );

  // Soru başlıkları cümleye küçük harfle girer ("Takım Çalışması ve İş
  // Birliği" özel ad değildir). Başlıksız eski cevaplar metin dışı kalır.
  const basliklar = girdi.soruOrtalamalari
    .filter(
      (s): s is SoruOrtalamasi & { baslik: string; ortalama: number } =>
        s.baslik !== null && s.ortalama !== null,
    )
    .sort((a, b) => b.ortalama - a.ortalama)
    .map((s) => ({ ad: s.baslik.toLocaleLowerCase("tr-TR"), ortalama: s.ortalama }));

  if (basliklar.length >= 2) {
    const [birinci, ikinci] = basliklar;
    const nitelik =
      girdi.basari?.kademe === "YUKSEK"
        ? "güçlü bir görünüm sergilemiştir"
        : girdi.basari?.kademe === "DUSUK"
          ? "görece daha olumlu bir görünüm sergilemiştir"
          : "olumlu bir görünüm sergilemiştir";
    cumleler.push(
      `Değerlendirmelerde özellikle ${birinci.ad} ile ${ikinci.ad} başlıklarında ${nitelik}.`,
    );

    // Desteklenecek alan yalnızca gerçekten geride kalan bir başlık varsa
    // anılır; her metne zorla bir eksik yazmak veriden çıkmayan bir sonuç
    // üretmek olurdu.
    const sonuncu = basliklar[basliklar.length - 1];
    if (sonuncu.ortalama < 3.5 && birinci.ortalama - sonuncu.ortalama >= 0.5) {
      cumleler.push(
        `${sonuncu.ad
          .charAt(0)
          .toLocaleUpperCase("tr-TR")}${sonuncu.ad.slice(1)} başlığındaki gelişimi sürmekte olup bu alanın etkinliklerle desteklenmesinin faydalı olacağı değerlendirilmektedir.`,
      );
    }
  }

  // Yüksek ve Ortalama için kapanış cümlesi yazılmaz: kutunun yanındaki
  // skala aynı hükmü zaten veriyor, beş kutuda beş özdeş kalıp velide
  // "şablon" hissi bırakıyordu (veli incelemesi bulgusu). Düşük'te skalayı
  // yumuşatan çerçeve, kademesizlikte ise sebep cümlesi korunur.
  switch (girdi.basari?.kademe) {
    case "YUKSEK":
    case "ORTALAMA":
      break;
    case "DUSUK":
      cumleler.push(
        "Atölyedeki kazanımlara ulaşma düzeyinin planlı etkinliklerle desteklenmesinin faydalı olacağı değerlendirilmektedir.",
      );
      break;
    default:
      cumleler.push(
        "Bu atölyede kazanımlara ulaşma düzeyi için yeterli değerlendirme oluşmamıştır.",
      );
  }

  return cumleler.join(" ");
}

/**
 * §11.2 — Üç gelişim alanının kademesi ve değerlendirme cümlesi.
 *
 * Bu bölüm GRUPLA KIYASLANIR; grup ortalaması yoksa (öğrenci grubun tek
 * değerlendirilmiş üyesiyse) cümle yaşıt karşılaştırması yapmaz.
 */
export function gelisimAlanlariCikar(
  ogrenciOrtalamalari: readonly {
    kategori: string;
    ortalama: number | null;
  }[],
  grupOrtalamalari: ReadonlyMap<string, number>,
  kazanimlar: ReadonlyMap<string, string[]>,
  esikler: RaporEsikleri = VARSAYILAN_ESIKLER,
  /** Aynı öğrencinin dönem ortası ortalamaları; form doldurulmadıysa boş. */
  ortaOrtalamalari: ReadonlyMap<string, number> = new Map(),
): GelisimAlaniSatiri[] {
  return ogrenciOrtalamalari.map((alan) => {
    const grupOrtalamasi = grupOrtalamalari.get(alan.kategori) ?? null;
    const ortaOrtalamasi = ortaOrtalamalari.get(alan.kategori) ?? null;
    const bant = gelisimBandi(alan.ortalama, grupOrtalamasi, esikler);
    const alanKazanimlari = kazanimlar.get(alan.kategori) ?? [];
    // "Duygusal Gelişim Alanları" → "duygusal beceriler"
    const kisaAd = alan.kategori
      .replace(/Gelişim Alanları/i, "beceriler")
      .toLocaleLowerCase("tr-TR");

    return {
      ad: alan.kategori,
      bant,
      kazanimlar: alanKazanimlari,
      ogrenciOrtalamasi: alan.ortalama,
      grupOrtalamasi,
      ortaOrtalamasi,
      degisim: gelisimDegisimi(ortaOrtalamasi, alan.ortalama, kisaAd, esikler),
      cumle: bant
        ? gelisimCumlesi(
            bant,
            kisaAd,
            kazanimOzeti(alanKazanimlari),
            grupOrtalamasi !== null,
          )
        : null,
    };
  });
}

/**
 * Kazanım başlıklarını cümleye gömülebilecek kısa bir listeye indirger.
 *
 * Örnek rapordaki gibi tırnak içinde birkaç örnek verilir; hepsini saymak
 * cümleyi okunmaz hâle getirirdi.
 */
function kazanimOzeti(kazanimlar: readonly string[], enFazla = 4): string {
  const secilenler = kazanimlar
    .slice(0, enFazla)
    .map((k) => k.toLocaleLowerCase("tr-TR"));

  if (secilenler.length === 0) return "bu alandaki kazanımlar";
  if (secilenler.length === 1) return `"${secilenler[0]}"`;
  return `"${secilenler.slice(0, -1).join(", ")} ve ${secilenler.at(-1)}"`;
}

export { asimetriBul };
