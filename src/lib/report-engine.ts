import {
  atolyeOzetiHesapla,
  ortalama,
  type AtolyeOzeti,
  type PuanlamaGirdisi,
  type SoruOrtalamasi,
} from "./scoring";
import { tamlayanEkiyle } from "./turkce";

/**
 * Rapor motoru — §11.
 *
 * İki katman kasten ayrılmıştır:
 *
 *   1. ANALİZ  — puanlardan hangi sonuçların çıkarılabileceğine karar verir.
 *                Çıktısı yapılandırılmış veri, metin değil.
 *   2. METİN   — bu veriyi Türkçe cümlelere çevirir. Şu an şablon blokları
 *                kullanır; P13'te yerine Claude API geçecek.
 *
 * Bu ayrım sayesinde yapay zekâ eklendiğinde analiz katmanı, veri modeli,
 * arayüz ve PDF hiç değişmez — yalnızca 2. katman değişir. §11.3'ün kuralları
 * (veride olmayan özellik uydurulmaz, tek düşük puandan kesin yargı
 * çıkarılmaz, az veri varsa ihtiyatlı dil, "Değerlendirilemedi" olumsuz
 * sayılmaz) 1. katmanda kod olarak uygulanır; metin katmanı yalnızca
 * kendisine verilen bulguları yazar.
 *
 * Bütün fonksiyonlar saf: veritabanı bilmezler, tarih üretmezler.
 */

// ---------------------------------------------------------------------------
// Eşikler
// ---------------------------------------------------------------------------

/** Bu ortalamanın üstü "güçlü", altındaki eşik ise "desteklenebilir" sayılır. */
const GUCLU_ESIGI = 4.2;
const DESTEK_ESIGI = 2.6;

/**
 * Bir bulgunun rapora girebilmesi için gereken en az gözlem sayısı.
 *
 * §11.3 — Tek bir düşük puandan kesin ve ağır bir kişilik yargısı
 * üretilmemelidir. Bu yüzden bir soru en az iki kez puanlanmadıkça güçlü ya
 * da desteklenecek alan olarak yazılmaz; tek gözlem varsa yalnızca genel
 * ortalamaya katkı verir.
 */
const EN_AZ_GOZLEM = 2;

/** Bu sayının altındaki katılımda metin ihtiyatlı dil kullanır. */
const IHTIYATLI_OTURUM_SINIRI = 3;

// ---------------------------------------------------------------------------
// Analiz katmanı
// ---------------------------------------------------------------------------

export type AtolyeGirdisi = {
  atolyeAdi: string;
  puanlamalar: PuanlamaGirdisi[];
};

export type KapsamGirdisi = {
  programAdi: string;
  grupAdi: string;
  tur: "Dönem" | "Kulüp";
};

export type RaporGirdisi = {
  ogrenciAdi: string;
  /** Metinde kullanılacak ad — genelde öğrencinin ilk adı. */
  ogrenciIlkAdi: string;
  kapsam: KapsamGirdisi[];
  atolyeler: AtolyeGirdisi[];
};

export type Bulgu = {
  soruMetni: string;
  ortalama: number;
  gozlemSayisi: number;
};

export type AtolyeAnalizi = AtolyeOzeti & {
  atolyeAdi: string;
  guclu: Bulgu[];
  desteklenecek: Bulgu[];
  /** Katılım az olduğunda metin temkinli yazılır. */
  ihtiyatli: boolean;
  /** Hiç puanlanmamış atölye rapora "veri yok" olarak girer. */
  veriVar: boolean;
};

export type RaporAnalizi = {
  ogrenciAdi: string;
  ogrenciIlkAdi: string;
  kapsam: KapsamGirdisi[];
  atolyeler: AtolyeAnalizi[];
  genel: {
    katildigiOturumSayisi: number;
    katilmadigiOturumSayisi: number;
    genelOrtalama: number | null;
    guclu: Bulgu[];
    desteklenecek: Bulgu[];
    ihtiyatli: boolean;
    veriVar: boolean;
  };
};

function bulguyaCevir(soru: SoruOrtalamasi): Bulgu | null {
  if (soru.ortalama === null) return null;
  return {
    soruMetni: soru.soruMetni,
    ortalama: soru.ortalama,
    gozlemSayisi: soru.puanlananOturumSayisi,
  };
}

/** Yeterince gözlenmiş sorulardan güçlü ve desteklenecek alanları ayırır. */
function alanlariAyir(soruOrtalamalari: readonly SoruOrtalamasi[]): {
  guclu: Bulgu[];
  desteklenecek: Bulgu[];
} {
  const bulgular = soruOrtalamalari
    .map(bulguyaCevir)
    .filter((bulgu): bulgu is Bulgu => bulgu !== null)
    .filter((bulgu) => bulgu.gozlemSayisi >= EN_AZ_GOZLEM);

  return {
    guclu: bulgular
      .filter((bulgu) => bulgu.ortalama >= GUCLU_ESIGI)
      .sort((a, b) => b.ortalama - a.ortalama),
    desteklenecek: bulgular
      .filter((bulgu) => bulgu.ortalama <= DESTEK_ESIGI)
      .sort((a, b) => a.ortalama - b.ortalama),
  };
}

/**
 * §11.2.A + §11.3 — Puanlardan yapılandırılmış rapor verisi üretir.
 *
 * Metin üretmez; yalnızca "hangi sonuçlar bu verilerden çıkarılabilir"
 * sorusunu cevaplar.
 */
export function raporAnaliziUret(girdi: RaporGirdisi): RaporAnalizi {
  const atolyeler: AtolyeAnalizi[] = girdi.atolyeler.map((atolye) => {
    const ozet = atolyeOzetiHesapla(atolye.puanlamalar);
    const { guclu, desteklenecek } = alanlariAyir(ozet.soruOrtalamalari);

    return {
      ...ozet,
      atolyeAdi: atolye.atolyeAdi,
      guclu,
      desteklenecek,
      ihtiyatli: ozet.katildigiOturumSayisi < IHTIYATLI_OTURUM_SINIRI,
      veriVar: ozet.genelOrtalama !== null,
    };
  });

  // Genel değerlendirme bütün atölyelerin soru ortalamalarını birlikte
  // değerlendirir: aynı soru farklı atölyelerde de sorulduğu için metin
  // adına göre birleştirilir.
  const soruHavuzu = new Map<
    string,
    { toplamlar: number[]; gozlem: number }
  >();

  for (const atolye of atolyeler) {
    for (const soru of atolye.soruOrtalamalari) {
      if (soru.ortalama === null) continue;
      const mevcut = soruHavuzu.get(soru.soruMetni);
      if (mevcut) {
        mevcut.toplamlar.push(soru.ortalama);
        mevcut.gozlem += soru.puanlananOturumSayisi;
      } else {
        soruHavuzu.set(soru.soruMetni, {
          toplamlar: [soru.ortalama],
          gozlem: soru.puanlananOturumSayisi,
        });
      }
    }
  }

  const genelSorular: SoruOrtalamasi[] = [...soruHavuzu.entries()].map(
    ([soruMetni, veri], sira) => ({
      anahtar: soruMetni,
      soruMetni,
      ortalama: ortalama(veri.toplamlar),
      puanlananOturumSayisi: veri.gozlem,
      sortOrder: sira,
    }),
  );

  const genelAlanlar = alanlariAyir(genelSorular);

  const katildigi = atolyeler.reduce(
    (toplam, a) => toplam + a.katildigiOturumSayisi,
    0,
  );
  const katilmadigi = atolyeler.reduce(
    (toplam, a) => toplam + a.katilmadigiOturumSayisi,
    0,
  );

  return {
    ogrenciAdi: girdi.ogrenciAdi,
    ogrenciIlkAdi: girdi.ogrenciIlkAdi,
    kapsam: girdi.kapsam,
    atolyeler,
    genel: {
      katildigiOturumSayisi: katildigi,
      katilmadigiOturumSayisi: katilmadigi,
      genelOrtalama: ortalama(
        atolyeler.flatMap((a) =>
          a.genelOrtalama === null ? [] : [a.genelOrtalama],
        ),
      ),
      guclu: genelAlanlar.guclu,
      desteklenecek: genelAlanlar.desteklenecek,
      ihtiyatli: katildigi < IHTIYATLI_OTURUM_SINIRI,
      veriVar: katildigi > 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Metin katmanı
// ---------------------------------------------------------------------------

export type RaporMetni = {
  atolyeler: { atolyeAdi: string; paragraf: string }[];
  genelParagraflar: string[];
};

export type RaporGovdesi = {
  analiz: RaporAnalizi;
  metin: RaporMetni;
  /** Metnin nasıl üretildiği — P13'te "ai" değerini alacak. */
  metinKaynagi: "sablon";
};

/**
 * Bulguları "şunu, şunu ve şunu" biçiminde birleştirir. Soru metinleri cümle
 * olarak yazıldığı için sondaki nokta ve ilk harf küçültülerek cümleye
 * gömülür.
 */
function bulgulariBirlestir(bulgular: readonly Bulgu[], enFazla = 3): string {
  const parcalar = bulgular.slice(0, enFazla).map((bulgu) => {
    const metin = bulgu.soruMetni.trim().replace(/\.$/, "");
    return metin.charAt(0).toLocaleLowerCase("tr-TR") + metin.slice(1);
  });

  if (parcalar.length === 0) return "";
  if (parcalar.length === 1) return parcalar[0];
  return `${parcalar.slice(0, -1).join(", ")} ve ${parcalar.at(-1)}`;
}

/**
 * Aynı cümle kalıbının her atölyede tekrar etmemesi için sıraya göre dönüşümlü
 * seçim yapar (§11.3 — metin tekrarlarından kaçınılmalıdır). Rastgelelik
 * kullanılmaz: aynı veriden her zaman aynı rapor çıkmalı.
 */
function dongu<T>(secenekler: readonly T[], sira: number): T {
  return secenekler[sira % secenekler.length];
}

const GUCLU_KALIPLARI = [
  (ad: string, alanlar: string) =>
    `${ad} bu atölyede özellikle ${alanlar} konularında güçlü bir performans sergilediği gözlemlenmiştir.`,
  (ad: string, alanlar: string) =>
    `${ad} ${alanlar} alanlarında istikrarlı bir başarı gösterdiği görülmüştür.`,
  (ad: string, alanlar: string) =>
    `Değerlendirmelerde ${ad} ${alanlar} konularında öne çıktığı kaydedilmiştir.`,
];

const DESTEK_KALIPLARI = [
  (ad: string, alanlar: string) =>
    `${ad} ${alanlar} konularında zaman zaman yönlendirmeye ihtiyaç duyduğu; bu alanların desteklenmesinin gelişimine katkı sağlayacağı değerlendirilmektedir.`,
  (ad: string, alanlar: string) =>
    `${ad} ${alanlar} alanlarında desteklendiğinde daha bağımsız çalışabileceği düşünülmektedir.`,
];

const DENGELI_KALIPLARI = [
  (ad: string) =>
    `${ad} bu atölyedeki değerlendirmelerinin genel olarak dengeli bir seyir izlediği görülmüştür.`,
  (ad: string) =>
    `${ad} atölye boyunca istikrarlı bir katılım sergilediği kaydedilmiştir.`,
];

function katilimCumlesi(analiz: AtolyeAnalizi): string {
  const katildi = analiz.katildigiOturumSayisi;
  const katilmadi = analiz.katilmadigiOturumSayisi;

  const temel =
    katildi === 1
      ? "Bu atölyede bir oturum değerlendirilmiştir"
      : `Bu atölyede ${katildi} oturum değerlendirilmiştir`;

  // §11.3 — Katılmadığı oturumlar olumsuz bir yargı gibi yazılmaz, yalnızca
  // kapsamı belirtmek için sayılır.
  return katilmadi > 0
    ? `${temel}; ${katilmadi} oturuma katılım sağlanmamış ve bu oturumlar ortalamaya dahil edilmemiştir.`
    : `${temel}.`;
}

/** §11.2.A — Bir atölyenin yazılı değerlendirmesi. */
function atolyeParagrafi(
  analiz: AtolyeAnalizi,
  adEkli: string,
  sira: number,
): string {
  if (!analiz.veriVar) {
    return analiz.katilmadigiOturumSayisi > 0
      ? `Bu atölyede değerlendirme yapılabilecek bir oturum bulunmamaktadır; ${analiz.katilmadigiOturumSayisi} oturuma katılım sağlanmamıştır.`
      : "Bu atölye için henüz puanlama girilmemiştir.";
  }

  const cumleler: string[] = [katilimCumlesi(analiz)];

  if (analiz.guclu.length > 0) {
    cumleler.push(
      dongu(GUCLU_KALIPLARI, sira)(adEkli, bulgulariBirlestir(analiz.guclu)),
    );
  } else {
    cumleler.push(dongu(DENGELI_KALIPLARI, sira)(adEkli));
  }

  if (analiz.desteklenecek.length > 0) {
    cumleler.push(
      dongu(DESTEK_KALIPLARI, sira)(
        adEkli,
        bulgulariBirlestir(analiz.desteklenecek),
      ),
    );
  }

  if (analiz.ihtiyatli) {
    cumleler.push(
      "Değerlendirme sayısı sınırlı olduğu için bu sonuçlar ön gözlem niteliğindedir.",
    );
  }

  return cumleler.join(" ");
}

/** §11.2.B — Bütün atölyeleri birlikte değerlendiren genel metin. */
function genelParagraflar(analiz: RaporAnalizi, adEkli: string): string[] {
  if (!analiz.genel.veriVar) {
    return [
      `${analiz.ogrenciAdi} için henüz değerlendirilmiş bir atölye oturumu bulunmamaktadır. Puanlamalar girildikçe rapor içeriği oluşacaktır.`,
    ];
  }

  const paragraflar: string[] = [];

  const degerlendirilenAtolyeler = analiz.atolyeler.filter((a) => a.veriVar);

  paragraflar.push(
    `${adEkli} ${degerlendirilenAtolyeler.length} atölyedeki ${analiz.genel.katildigiOturumSayisi} oturumu değerlendirilmiştir.` +
      (analiz.genel.katilmadigiOturumSayisi > 0
        ? ` Katılım sağlanmayan ${analiz.genel.katilmadigiOturumSayisi} oturum ortalamalara dahil edilmemiştir.`
        : ""),
  );

  if (analiz.genel.guclu.length > 0) {
    paragraflar.push(
      `Değerlendirmeler bütününde ${adEkli} ${bulgulariBirlestir(analiz.genel.guclu)} konularında güçlü olduğu görülmektedir.`,
    );
  }

  if (analiz.genel.desteklenecek.length > 0) {
    paragraflar.push(
      `${bulgulariBirlestir(analiz.genel.desteklenecek).charAt(0).toLocaleUpperCase("tr-TR")}${bulgulariBirlestir(analiz.genel.desteklenecek).slice(1)} alanlarının desteklenmesi gelişimine katkı sağlayacaktır.`,
    );
  }

  if (analiz.genel.guclu.length === 0 && analiz.genel.desteklenecek.length === 0) {
    paragraflar.push(
      `Mevcut değerlendirmeler ${adEkli} genel olarak dengeli bir gelişim gösterdiğine işaret etmektedir.`,
    );
  }

  if (analiz.genel.ihtiyatli) {
    paragraflar.push(
      "Değerlendirme sayısı henüz sınırlı olduğundan bu metin ön gözlem niteliğindedir; ilerleyen oturumlarla birlikte rapor güncellenebilir.",
    );
  }

  return paragraflar;
}

/**
 * Analiz çıktısını Türkçe metne çevirir.
 *
 * P13'te bu fonksiyonun yerini Claude API çağrısı alacak; girdisi ve çıktısı
 * aynı kalacağı için arayüz, veri modeli ve PDF etkilenmeyecek.
 */
export function raporMetniUret(analiz: RaporAnalizi): RaporMetni {
  const adEkli = tamlayanEkiyle(analiz.ogrenciIlkAdi);

  return {
    atolyeler: analiz.atolyeler.map((atolye, sira) => ({
      atolyeAdi: atolye.atolyeAdi,
      paragraf: atolyeParagrafi(atolye, adEkli, sira),
    })),
    genelParagraflar: genelParagraflar(analiz, adEkli),
  };
}

/** Analiz + metin: raporun saklanacak gövdesi. */
export function raporUret(girdi: RaporGirdisi): RaporGovdesi {
  const analiz = raporAnaliziUret(girdi);
  return {
    analiz,
    metin: raporMetniUret(analiz),
    metinKaynagi: "sablon",
  };
}
