import { ortalamaBicimle } from "./puan-hesaplari";
import { tamlayanEkiyle } from "./turkce";
import type { RaporAnalizi, Bulgu, RaporGirdisi } from "./rapor-motoru";
import { raporAnaliziUret } from "./rapor-motoru";

/**
 * Veli görüşmesi brief'i — görüşmeyi yapacak kişiye hazırlanan konuşma özeti.
 *
 * Rapor motoruyla aynı ilke (bkz. `rapor-motoru.ts`): buradaki her fonksiyon
 * SAF — veritabanı bilmez, tarih üretmez, rastgelelik kullanmaz. Aynı girdiden
 * her zaman aynı metin çıkar; sunucu eylemi bu sayede önizlemede üretilen
 * brief'i istemciden geri taşımak yerine kayıt anında yeniden üretebiliyor.
 * P13'te metin üretimi Claude API'ye geçtiğinde bu varsayım bozulur —
 * o gün "önizlenen metni sakla" modeline dönülmeli (`metinKaynagi: "ai"`).
 *
 * Brief iki AYRI bölümdür ve ikisi karıştırılmaz:
 *   (a) mini test yorumu    — görüşmeciye sorulan kısa testin cevaplarından
 *   (b) atölye özeti        — görüşme tarihine KADARki stajyer puanlamalarından
 */

// ---------------------------------------------------------------------------
// Mini test soruları
// ---------------------------------------------------------------------------

export type MiniTestSorusu = { anahtar: string; metin: string };

/**
 * GEÇİCİ yer tutucu sorular — kurumun elindeki hazır soru tipleri geldiğinde
 * bu liste değişecek. Cevap kaydı soru metnini kendi içinde taşıdığı için
 * (`MiniTestCevabi.soruMetni`, `questionTextSnapshot` ilkesi) listeyi
 * değiştirmek geçmiş kayıtları bozmaz.
 *
 * Sorular puanlama sorularıyla aynı biçimde, olumlu yargı cümlesi olarak
 * yazılır; yorum kalıpları cümleyi küçük harfle metne gömer.
 */
export const MINI_TEST_SORULARI: readonly MiniTestSorusu[] = [
  {
    anahtar: "sosyallik",
    metin: "Akranlarıyla kolay iletişim kurar ve gruba uyum sağlar.",
  },
  {
    anahtar: "ozguven",
    metin: "Etkinliklerde kendine güvenir ve fikrini rahatça ifade eder.",
  },
  {
    anahtar: "motivasyon",
    metin: "Atölye çalışmalarına istekli katılır ve başladığı işi tamamlar.",
  },
];

/** 1–5; puanlama ölçeğiyle aynı yön: 5 en olumlu. */
export type MiniTestCevabi = {
  anahtar: string;
  /** Cevap anındaki soru metni — sorular değişse de kayıt o günkü hâli gösterir. */
  soruMetni: string;
  deger: number;
};

// ---------------------------------------------------------------------------
// Brief gövdesi
// ---------------------------------------------------------------------------

export type VeliBriefi = {
  /** (a) Mini test cevaplarının yoruma çevrilmiş hâli. */
  miniTestParagraflari: string[];
  /** (b) Görüşme tarihine kadarki atölyelerin çok kısa özeti. */
  atolyeParagraflari: string[];
  /** Özetin dayandığı analiz; hiç puanlama yoksa null. */
  analiz: RaporAnalizi | null;
  /** Metnin nasıl üretildiği — P13'te "ai" değerini alacak. */
  metinKaynagi: "sablon";
};

/** Soru cümlesini akan metne gömülecek biçime çevirir (rapor motoru deseni). */
function cumleyeGom(soruMetni: string): string {
  const metin = soruMetni.trim().replace(/\.$/, "");
  return metin.charAt(0).toLocaleLowerCase("tr-TR") + metin.slice(1);
}

/**
 * Aynı kalıbın art arda tekrar etmemesi için sıraya göre dönüşümlü seçim —
 * `rapor-motoru.ts`teki `dongu` ile aynı; rastgelelik yok.
 */
function dongu<T>(secenekler: readonly T[], sira: number): T {
  return secenekler[sira % secenekler.length];
}

const YUKSEK_KALIPLARI = [
  (ad: string, alan: string) =>
    `${ad} ${alan} yönüyle güçlü bir görünüm sergilemektedir; görüşmede bu güçlü yön somut bir örnekle vurgulanabilir.`,
  (ad: string, alan: string) =>
    `${ad} ${alan} açısından olumlu bir noktada; veliyle paylaşılacak güzel bir gözlemdir.`,
];

const ORTA_KALIPLARI = [
  (ad: string, alan: string) =>
    `${ad} ${alan} yönüyle dengeli bir seyir izlemektedir; görüşmede mevcut durumun korunması konuşulabilir.`,
  (ad: string, alan: string) =>
    `${ad} ${alan} açısından beklenen düzeyde ilerlemektedir.`,
];

const DUSUK_KALIPLARI = [
  (ad: string, alan: string) =>
    `${ad} ${alan} yönüyle desteğe ihtiyaç duymaktadır; veliyle bu alanın evde nasıl destekleneceği konuşulmalıdır.`,
  (ad: string, alan: string) =>
    `${ad} ${alan} açısından gelişim alanı göstermektedir; görüşmede yargılayıcı olmayan bir dille ele alınması önerilir.`,
];

/**
 * (a) Mini test cevaplarını görüşme öncesi hatırlatma cümlelerine çevirir.
 *
 * Değer bantları: 1–2 destek, 3 dengeli, 4–5 güçlü. Cevap sırası korunur —
 * görüşmeci hangi sırayla cevapladıysa yorum da o sırada gelir.
 */
export function miniTestYorumuUret(
  ogrenciIlkAdi: string,
  cevaplar: readonly MiniTestCevabi[],
): string[] {
  const adEkli = tamlayanEkiyle(ogrenciIlkAdi);

  return cevaplar.map((cevap, sira) => {
    const alan = cumleyeGom(cevap.soruMetni);
    const kaliplar =
      cevap.deger >= 4
        ? YUKSEK_KALIPLARI
        : cevap.deger === 3
          ? ORTA_KALIPLARI
          : DUSUK_KALIPLARI;
    return dongu(kaliplar, sira)(adEkli, `“${alan}”`);
  });
}

/**
 * (b) Görüşme tarihine kadarki atölyelerin ÇOK KISA özeti.
 *
 * Yalnızca analizdeki `genel` bölüm kullanılır; atölye atölye paragraf yok —
 * bu bir rapor değil, görüşme öncesi iki dakikada okunacak bir hatırlatma.
 * §11.3 kuralları (az veriyle ihtiyatlı dil, tek gözlemden yargı çıkmaz)
 * analiz katmanında zaten uygulanmış durumda; burada yalnızca verilen
 * bulgular yazılır.
 */
export function atolyeOzetiMetniUret(analiz: RaporAnalizi): string[] {
  const adEkli = tamlayanEkiyle(analiz.ogrenciIlkAdi);

  if (!analiz.genel.veriVar) {
    return [
      "Bu tarihe kadar değerlendirilmiş atölye oturumu bulunmamaktadır.",
    ];
  }

  const cumleler: string[] = [];

  const atolyeSayisi = analiz.atolyeler.filter((a) => a.veriVar).length;
  const ortalamaMetni =
    analiz.genel.genelOrtalama === null
      ? ""
      : ` Genel ortalama ${ortalamaBicimle(analiz.genel.genelOrtalama)}.`;

  cumleler.push(
    `${adEkli} bu görüşme tarihine kadar ${atolyeSayisi} atölyedeki ${analiz.genel.katildigiOturumSayisi} oturumu değerlendirilmiştir.` +
      (analiz.genel.katilmadigiOturumSayisi > 0
        ? ` ${analiz.genel.katilmadigiOturumSayisi} oturuma katılım sağlanmamıştır.`
        : "") +
      ortalamaMetni,
  );

  const bulgulariYaz = (bulgular: readonly Bulgu[], enFazla: number) =>
    bulgular
      .slice(0, enFazla)
      .map((bulgu) => cumleyeGom(bulgu.soruMetni))
      .join(", ");

  if (analiz.genel.guclu.length > 0) {
    cumleler.push(
      `Güçlü görünen alanlar: ${bulgulariYaz(analiz.genel.guclu, 2)}.`,
    );
  }

  if (analiz.genel.desteklenecek.length > 0) {
    cumleler.push(
      `Desteklenebilecek alan: ${bulgulariYaz(analiz.genel.desteklenecek, 1)}.`,
    );
  }

  if (analiz.genel.ihtiyatli) {
    cumleler.push(
      "Değerlendirme sayısı henüz sınırlı; bu gözlemler ön izlenim niteliğindedir ve veliyle bu ihtiyat payı belirtilerek paylaşılmalıdır.",
    );
  }

  return cumleler;
}

/**
 * Brief'in saklanacak gövdesi — `raporUret` deseninin veli görüşmesi karşılığı.
 *
 * `raporGirdisi` null gelebilir (öğrencinin hiç kaydı yok); o durumda atölye
 * bölümü tek "veri yok" cümlesidir ve analiz saklanmaz.
 */
export function veliBriefiUret(girdi: {
  ogrenciIlkAdi: string;
  cevaplar: readonly MiniTestCevabi[];
  raporGirdisi: RaporGirdisi | null;
}): VeliBriefi {
  const analiz = girdi.raporGirdisi
    ? raporAnaliziUret(girdi.raporGirdisi)
    : null;

  return {
    miniTestParagraflari: miniTestYorumuUret(girdi.ogrenciIlkAdi, girdi.cevaplar),
    atolyeParagraflari: analiz
      ? atolyeOzetiMetniUret(analiz)
      : ["Bu tarihe kadar değerlendirilmiş atölye oturumu bulunmamaktadır."],
    analiz,
    metinKaynagi: "sablon",
  };
}
