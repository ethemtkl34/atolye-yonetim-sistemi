import {
  beceriEtiketiCikar,
  type BeceriEtiketi,
} from "./beceri-etiketleri";

/**
 * Veli görüşmesi formunun ön-doldurma motoru — Bölüm 3 ve Bölüm 4.
 *
 * NEDEN: uzman görüşmeden önce dokuz gözlem alanını 1–5 puanlıyor ve
 * zorlandığı alanları işaretliyor. Bu bilginin büyük kısmı sistemde ZATEN
 * var — stajyerin haftalarca girdiği atölye puanlamaları ve 18 soruluk
 * gelişim testi. Uzmanın onu ikinci kez, hafızasından üretmesi hem zaman
 * kaybı hem de sistemdeki ölçümle çelişme riski.
 *
 * ÖNERİ, KARAR DEĞİL: bu dosyanın çıktısı forma yazılmaz; ekranda "öneri"
 * olarak durur ve uzman tek tek kabul eder. Gerekçe (`dayanak`) her önerinin
 * yanında taşınır — uzman sayının nereden geldiğini görmeden kabul etmek
 * zorunda kalmamalı.
 *
 * ÖLÇÜLMEYEN ALAN ÖNERİLMEZ: Kaygı, Duyu Hassasiyeti, Mükemmeliyetçilik,
 * İçe Kapanıklık ve Görsel Algı için sistemde HİÇBİR ölçüm yok. Bunlar
 * uzmanın klinik gözlemiyle işaretlenir; buradan asla önerilmez. Zorlama bir
 * eşleştirme, bir çocuğun kaydına dayanaksız bir "zorlanma" işareti koymak
 * olurdu (`beceri-etiketleri.ts`teki "zorlama eşleşme yapmayız" ilkesi).
 *
 * Bütün fonksiyonlar saf: veritabanı bilmezler, tarih üretmezler.
 */

// ---------------------------------------------------------------------------
// Girdi
// ---------------------------------------------------------------------------

export type OneriGirdisi = {
  /**
   * Atölye puanlamalarının soru başlığı bazlı ortalamaları. Başlıklar
   * `beceriEtiketiCikar` ile ortak sözcüğe indirgenir.
   */
  atolyeBasliklari: readonly {
    baslik: string;
    ortalama: number;
    gozlemSayisi: number;
  }[];
  /** Gelişim testinin cevapları — soru ANAHTARIYLA, başlıkla değil. */
  gelisimCevaplari: readonly { anahtar: string; deger: number }[];
  /** Gelişim testinin hangi dönem noktası olduğu — dayanak metnine girer. */
  gelisimDonemi: string | null;
  /** Yoklama: değerlendirme kapsamındaki oturum sayısı ve katılım. */
  katilim: { kapsam: number; katildi: number } | null;
};

export type PuanOnerisi = {
  /** `GOZLEM_ALANLARI` anahtarı. */
  anahtar: string;
  /** Önerilen 1–5 puan. */
  deger: number;
  /** Sayının nereden geldiği — uzman kabul etmeden önce okur. */
  dayanak: string;
};

export type ZorlanmaOnerisi = {
  /** `ZORLANMA_GRUPLARI` anahtarı. */
  anahtar: string;
  dayanak: string;
};

export type GorusmeOnerileri = {
  gozlemPuanlari: PuanOnerisi[];
  zorlanmalar: ZorlanmaOnerisi[];
  /** Veri bulunamadığı için önerilemeyen gözlem alanlarının anahtarları. */
  onerilemeyenler: string[];
};

// ---------------------------------------------------------------------------
// Eşleme tabloları
// ---------------------------------------------------------------------------

/**
 * Dokuz gözlem alanının hangi ölçümlerden beslendiği.
 *
 * İki kaynak da 1–5 ölçeğinde olduğu için birlikte ortalanabiliyorlar.
 * `etiketler` atölye puanlamalarından (soru başlıkları ortak sözcüğe
 * indirgenmiş), `gelisim` ise 18 soruluk testin kendi anahtarlarından gelir —
 * test anahtarları sabit olduğu için orada indirgemeye gerek yok ve daha ince
 * ayrım yapılabiliyor ("Bellek" ile "Dikkat" ayrı sorular, ortak sözcükte
 * ikisi de `odaklanma`ya düşerdi).
 */
const GOZLEM_KAYNAKLARI: Record<
  string,
  { etiketler: BeceriEtiketi[]; gelisim: string[] }
> = {
  // "atolye-katilim" burada YOK: yoklamadan hesaplanıyor, puanlama sorusundan
  // değil (bkz. `katilimPuani`).
  "dikkat-surdurme": { etiketler: ["odaklanma"], gelisim: ["dikkat"] },
  "yonerge-takibi": { etiketler: ["isitsel-dikkat"], gelisim: ["dil-gelisimi"] },
  "problem-cozme": {
    etiketler: ["problem-cozme", "akil-yurutme"],
    gelisim: ["problem-cozme", "mantiksal-dusunme"],
  },
  uretkenlik: { etiketler: ["sira-disi-dusunme"], gelisim: [] },
  "sosyal-iletisim": {
    etiketler: ["iletisim"],
    gelisim: ["iletisim", "sosyal-inisiyatif"],
  },
  "grup-calismasi": {
    etiketler: ["is-birligi"],
    gelisim: ["is-birligi", "kurallara-uyum"],
  },
  "duygu-ifade": {
    etiketler: ["duygu-yonetimi", "empati"],
    gelisim: ["duygu-tanima", "empati-gelisimi"],
  },
  "oz-duzenleme": {
    etiketler: ["duygu-yonetimi", "sorumluluk"],
    gelisim: ["duygu-duzenleme", "bas-etme"],
  },
};

/**
 * Zorlanma alanlarının kaynakları.
 *
 * Burada olmayan anahtarlar ASLA önerilmez. Listede bulunmayanlar ve sebepleri:
 *   kaygi, duyuhassasiyeti, mukemmeliyetcilik, icekapaniklik
 *     — sistemde bunları ölçen tek bir soru yok; klinik gözlem alanı.
 *   gorsel (Görsel Algı)
 *     — ne gelişim testinde ne de ortak beceri sözcüğünde karşılığı var.
 *
 * `hafiza` yalnızca gelişim testinden beslenir: ortak sözcükte "bellek"
 * kelimesi `odaklanma` etiketine düşüyor ve atölye tarafından beslemek
 * dikkat ile hafızayı birbirine karıştırırdı.
 */
const ZORLANMA_KAYNAKLARI: Record<
  string,
  { etiketler: BeceriEtiketi[]; gelisim: string[] }
> = {
  dikkat: { etiketler: ["odaklanma"], gelisim: ["dikkat"] },
  hafiza: { etiketler: [], gelisim: ["bellek"] },
  problem: { etiketler: ["problem-cozme"], gelisim: ["problem-cozme"] },
  mantik: { etiketler: ["akil-yurutme"], gelisim: ["mantiksal-dusunme"] },
  sirali: { etiketler: ["stratejik-dusunme"], gelisim: ["planlama"] },
  iletisim: { etiketler: ["iletisim"], gelisim: ["iletisim", "dil-gelisimi"] },
  grup: { etiketler: ["is-birligi"], gelisim: ["is-birligi"] },
  paylasma: { etiketler: [], gelisim: ["uzlasma"] },
  liderlik: { etiketler: [], gelisim: ["sosyal-inisiyatif"] },
  duyguduzenleme: {
    etiketler: ["duygu-yonetimi"],
    gelisim: ["duygu-duzenleme", "bas-etme"],
  },
  ozguven: {
    etiketler: ["oz-guven"],
    gelisim: ["oz-yeterlilik", "olumlu-oz-algi"],
  },
  // `bagimsizlik` ortak sözcükte `oz-guven` etiketine düşüyor (anahtar
  // kelimeler arasında "bağımsız" var); atölye tarafından beslersek öz güven
  // ile bağımsızlığı aynı ölçüm sayardık.
  bagimsizlik: { etiketler: [], gelisim: ["bagimsizlik"] },
};

// ---------------------------------------------------------------------------
// Eşikler
// ---------------------------------------------------------------------------

type Kanit = {
  toplam: number;
  adet: number;
  /** Atölyeden gelen ölçüm adedi — dayanak metni iki kaynağı ayırabilsin. */
  atolyeAdedi: number;
  gelisimAdedi: number;
  /** Katkı veren atölye soru başlıkları. */
  kaynaklar: string[];
};


/**
 * Bir PUAN önerisi için gereken en az ölçüm sayısı (§11.3 ile aynı ihtiyat).
 *
 * Puan önerisi forma 1–5 arası bir sayı yazdırıyor; tek bir ölçümden
 * üretilmiş bir sayı, uzmanın kendi gözlemini bastıracak kadar kesin
 * görünür. İki ölçüm altında alan boş bırakılır.
 */
const EN_AZ_GOZLEM = 2;

/** Bu ortalamanın altı "zorlanma" olarak önerilir. */
const ZORLANMA_ESIGI = 2.5;

/**
 * Zorlanma önerisinin kanıt eşiği — puan önerisinden FARKLI ve bilerek.
 *
 * Tek ölçüm kuralı burada aynen uygulansaydı yalnızca bir gelişim testi
 * sorusundan beslenen alanlar (Hafıza, Paylaşma, Liderlik, Bağımsızlık) HİÇ
 * önerilemezdi — arayüzde sessiz bir delik olurdu. Ayrım kanıtın cinsinde:
 * gelişim testi cevabı stajyerin dönemin tamamına bakarak verdiği bir
 * yargıdır, atölye puanı ise tek bir anın ölçümü. Bu yüzden bir gelişim
 * cevabı tek başına yeter, atölye tarafında iki ölçüm aranır.
 *
 * Zaten karar değil öneri: kutu kendiliğinden işaretlenmez, uzman dayanağı
 * görüp kabul eder.
 */
function zorlanmaKanitiYeterMi(kanit: Kanit): boolean {
  return kanit.gelisimAdedi >= 1 || kanit.atolyeAdedi >= EN_AZ_GOZLEM;
}

// ---------------------------------------------------------------------------
// Hesap
// ---------------------------------------------------------------------------


function kanitTopla(
  girdi: OneriGirdisi,
  kaynak: { etiketler: BeceriEtiketi[]; gelisim: string[] },
): Kanit {
  const kanit: Kanit = {
    toplam: 0,
    adet: 0,
    atolyeAdedi: 0,
    gelisimAdedi: 0,
    kaynaklar: [],
  };

  for (const satir of girdi.atolyeBasliklari) {
    const etiket = beceriEtiketiCikar(satir.baslik);
    if (!etiket || !kaynak.etiketler.includes(etiket)) continue;
    // Ağırlıklı: 9 kez puanlanmış bir başlık, 2 kez puanlanmışla eşit
    // ağırlıkta sayılmamalı (rapor motorundaki genel ortalama ilkesi).
    kanit.toplam += satir.ortalama * satir.gozlemSayisi;
    kanit.adet += satir.gozlemSayisi;
    kanit.atolyeAdedi += satir.gozlemSayisi;
    kanit.kaynaklar.push(satir.baslik);
  }

  for (const cevap of girdi.gelisimCevaplari) {
    if (!kaynak.gelisim.includes(cevap.anahtar)) continue;
    kanit.toplam += cevap.deger;
    kanit.adet += 1;
    kanit.gelisimAdedi += 1;
  }

  return kanit;
}

/** Yoklama oranını 1–5 puana çevirir. */
function katilimPuani(katildi: number, kapsam: number): number {
  const oran = katildi / kapsam;
  if (oran >= 0.95) return 5;
  if (oran >= 0.85) return 4;
  if (oran >= 0.7) return 3;
  if (oran >= 0.5) return 2;
  return 1;
}

function ortalamaMetni(deger: number): string {
  return deger.toFixed(1).replace(".", ",");
}

/**
 * Bölüm 3 ve Bölüm 4 için önerileri hesaplar.
 *
 * Puan önerisi 1–5 aralığına yuvarlanır; kanıt yoksa ya da tek gözleme
 * dayanıyorsa öneri ÜRETİLMEZ ve alan `onerilemeyenler`e düşer — boş
 * bırakmak, zayıf bir sayı önermekten iyidir.
 */
export function gorusmeOnerileriUret(girdi: OneriGirdisi): GorusmeOnerileri {
  const gozlemPuanlari: PuanOnerisi[] = [];
  const onerilemeyenler: string[] = [];

  if (girdi.katilim && girdi.katilim.kapsam > 0) {
    const { katildi, kapsam } = girdi.katilim;
    gozlemPuanlari.push({
      anahtar: "atolye-katilim",
      deger: katilimPuani(katildi, kapsam),
      dayanak: `Yoklama: ${kapsam} oturumun ${katildi} tanesine katılım.`,
    });
  } else {
    onerilemeyenler.push("atolye-katilim");
  }

  for (const [anahtar, kaynak] of Object.entries(GOZLEM_KAYNAKLARI)) {
    const kanit = kanitTopla(girdi, kaynak);
    if (kanit.adet < EN_AZ_GOZLEM) {
      onerilemeyenler.push(anahtar);
      continue;
    }

    const ortalama = kanit.toplam / kanit.adet;
    gozlemPuanlari.push({
      anahtar,
      deger: Math.min(5, Math.max(1, Math.round(ortalama))),
      dayanak: dayanakMetni(kanit, ortalama, girdi.gelisimDonemi),
    });
  }

  const zorlanmalar: ZorlanmaOnerisi[] = [];
  for (const [anahtar, kaynak] of Object.entries(ZORLANMA_KAYNAKLARI)) {
    const kanit = kanitTopla(girdi, kaynak);
    if (!zorlanmaKanitiYeterMi(kanit)) continue;

    const ortalama = kanit.toplam / kanit.adet;
    if (ortalama > ZORLANMA_ESIGI) continue;

    zorlanmalar.push({
      anahtar,
      dayanak: dayanakMetni(kanit, ortalama, girdi.gelisimDonemi),
    });
  }

  return { gozlemPuanlari, zorlanmalar, onerilemeyenler };
}

function dayanakMetni(
  kanit: Kanit,
  ortalama: number,
  gelisimDonemi: string | null,
): string {
  const parcalar: string[] = [];
  if (kanit.atolyeAdedi > 0) {
    // En fazla üç başlık: dayanak bir kaynakça değil, tek bakışta okunacak
    // bir gerekçe.
    const basliklar = [...new Set(kanit.kaynaklar)].slice(0, 3).join(", ");
    parcalar.push(`atölye puanlamaları (${basliklar})`);
  }
  if (kanit.gelisimAdedi > 0) {
    parcalar.push(
      gelisimDonemi ? `${gelisimDonemi} gelişim testi` : "gelişim testi",
    );
  }

  const kaynakMetni = parcalar.join(" + ") || "mevcut ölçümler";
  return kanit.adet === 1
    ? `${kaynakMetni}; tek ölçüm, değeri ${ortalamaMetni(ortalama)}.`
    : `${kaynakMetni}; ${kanit.adet} ölçümün ortalaması ${ortalamaMetni(ortalama)}.`;
}
