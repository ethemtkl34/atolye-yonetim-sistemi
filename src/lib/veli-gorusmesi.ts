import { ortalamaBicimle } from "./puan-hesaplari";
import { tamlayanEkiyle } from "./turkce";
import type { RaporAnalizi, Bulgu, RaporGirdisi } from "./rapor-motoru";
import { raporAnaliziUret } from "./rapor-motoru";
import {
  GENEL_OZELLIKLER,
  GUCLU_YONLER,
  ZORLANMA_ALANLARI,
  type YasBandi,
} from "./veli-gorusmesi-icerik";
import type { YonlendirmeTuru } from "./yonlendirme-turleri";

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
 * Brief üç AYRI bölümdür ve karıştırılmazlar:
 *   (a) gözlem yorumu  — uzmanın puanladığı 9 gözlem alanından
 *   (b) atölye özeti   — görüşme tarihine KADARki stajyer puanlamalarından
 *   (c) görüşme çerçevesi — formun işaretlerinden derlenen "söylenecekler"
 */

// ---------------------------------------------------------------------------
// Bölüm 3 — Gözlem alanları
// ---------------------------------------------------------------------------

export type GozlemAlani = {
  /** Kayıtta ve form alanı adında kullanılan kararlı kimlik. */
  anahtar: string;
  /** Tabloda görünen kısa alan adı. */
  baslik: string;
  /** Puanlanan olumlu yargı cümlesi (puanlama sorularıyla aynı biçim). */
  metin: string;
};

/**
 * Kurumun görüşme formundaki (Bölüm 3) dokuz gözlem alanı.
 *
 * Bunlar 2026 Ağustos'una kadar burada duran üç soruluk "mini test"in yerini
 * aldı; o liste kodda açıkça geçici yer tutucu olarak işaretlenmişti. Cevap
 * kaydı alan adını ve cümlesini kendi içinde taşıdığı için
 * (`questionTextSnapshot` ilkesi) listeyi değiştirmek geçmiş kayıtları bozmaz —
 * eski üç cevaplı kayıtlar kendi soru metinleriyle görünmeye devam eder.
 */
export const GOZLEM_ALANLARI: readonly GozlemAlani[] = [
  {
    anahtar: "atolye-katilim",
    baslik: "Atölyeye katılım",
    metin: "Atölye etkinliklerine düzenli ve istekli katılım gösterir.",
  },
  {
    anahtar: "dikkat-surdurme",
    baslik: "Dikkatini sürdürme",
    metin: "Etkinlik boyunca dikkatini sürdürür.",
  },
  {
    anahtar: "yonerge-takibi",
    baslik: "Yönerge takibi",
    metin: "Verilen yönergeleri anlar ve sırasıyla uygular.",
  },
  {
    anahtar: "problem-cozme",
    baslik: "Problem çözme",
    metin: "Karşılaştığı zorluklara kendi çözümünü üretir.",
  },
  {
    anahtar: "uretkenlik",
    baslik: "Üretkenlik",
    metin: "Kendi fikirlerini üretir ve çalışmasına yansıtır.",
  },
  {
    anahtar: "sosyal-iletisim",
    baslik: "Sosyal iletişim",
    metin: "Akranları ve yetişkinlerle rahat iletişim kurar.",
  },
  {
    anahtar: "grup-calismasi",
    baslik: "Grup çalışması",
    metin: "Grup çalışmalarında iş birliği yapar.",
  },
  {
    anahtar: "duygu-ifade",
    baslik: "Duygularını ifade etme",
    metin: "Duygularını uygun bir biçimde ifade eder.",
  },
  {
    anahtar: "oz-duzenleme",
    baslik: "Öz düzenleme",
    metin: "Davranışlarını ve tepkilerini kendi düzenleyebilir.",
  },
];

/** 1–5; puanlama ölçeğiyle aynı yön: 5 en olumlu. */
export type GozlemCevabi = {
  anahtar: string;
  /** Cevap anındaki soru metni — sorular değişse de kayıt o günkü hâli gösterir. */
  soruMetni: string;
  /**
   * Cevap anındaki kısa alan adı. Eski (üç soruluk mini test) kayıtlarında
   * YOK — yorum üretimi o durumda soru metnine düşer.
   */
  baslik?: string;
  deger: number;
};

// ---------------------------------------------------------------------------
// Yaş bandı
// ---------------------------------------------------------------------------

export type BandSecimi = {
  band: YasBandi;
  /**
   * Öğrencinin yaşı formun yazıldığı 4–10 aralığının dışında mı. Dışındaysa
   * en yakın bant kullanılır ve ekranda uyarı gösterilir: metinler o yaş için
   * yazılmadı, uzman körlemesine güvenmemeli.
   */
  bandDisi: boolean;
};

/** Formun kapsadığı yaş aralığı. */
export const EN_KUCUK_YAS = 4;
export const EN_BUYUK_YAS = 10;

/**
 * Yaştan bant seçer; aralık dışını en yakın banda kıstırır.
 *
 * Kıstırmak, kilitlemekten iyi: 11 yaşındaki bir öğrenci için görüşme
 * yapılamaz demek yerine 8-10 bandının metinleri gösterilip uzmanın bunu
 * bilmesi sağlanır. Aynısı 4 altı için de geçerli — canlıda doğum tarihi
 * hatalı girilmiş kayıtlar var ve form onların yüzünden çalışmaz olmamalı.
 */
export function yasBandiSec(yas: number): BandSecimi {
  const kistirilmis = Math.min(Math.max(yas, EN_KUCUK_YAS), EN_BUYUK_YAS);
  const band: YasBandi =
    kistirilmis <= 5 ? "4-5" : kistirilmis <= 7 ? "6-7" : "8-10";
  return { band, bandDisi: yas !== kistirilmis };
}

// ---------------------------------------------------------------------------
// Brief gövdesi
// ---------------------------------------------------------------------------

/** Görüşme çerçevesinin tek bölümü — etiketi ekranda küçük başlık olur. */
export type CerceveBolumu = { etiket: string; metin: string };

export type VeliBriefi = {
  /** (a) Gözlem alanı puanlarının yoruma çevrilmiş hâli. */
  gozlemParagraflari: string[];
  /** (b) Görüşme tarihine kadarki atölyelerin çok kısa özeti. */
  atolyeParagraflari: string[];
  /** (c) Formun işaretlerinden derlenen "görüşmede söylenecekler". */
  cerceve: CerceveBolumu[];
  /** Özetin dayandığı analiz; hiç puanlama yoksa null. */
  analiz: RaporAnalizi | null;
  /** Metnin nasıl üretildiği — P13'te "ai" değerini alacak. */
  metinKaynagi: "sablon";
};

/**
 * Kayıttan okunan `briefJson`ı güvenle `VeliBriefi`ye çevirir.
 *
 * 2026 Ağustos öncesi kayıtlarda gözlem paragrafları `miniTestParagraflari`
 * adıyla, çerçeve ise hiç yok. Alan adı değiştiği için o kayıtlar normalize
 * edilmeden okunursa detay penceresi boş açılırdı (`gelisimCevaplariCozumle`
 * ile aynı gerekçe: eski bir kayıt biçimi ekranı düşürmemeli).
 */
export function veliBriefiCozumle(ham: unknown): VeliBriefi {
  const b =
    typeof ham === "object" && ham !== null
      ? (ham as Record<string, unknown>)
      : {};

  const metinDizisi = (deger: unknown): string[] =>
    Array.isArray(deger)
      ? deger.filter((x): x is string => typeof x === "string")
      : [];

  const cerceve = Array.isArray(b.cerceve)
    ? b.cerceve.filter(
        (x): x is CerceveBolumu =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Record<string, unknown>).etiket === "string" &&
          typeof (x as Record<string, unknown>).metin === "string",
      )
    : [];

  return {
    gozlemParagraflari: metinDizisi(
      b.gozlemParagraflari ?? b.miniTestParagraflari,
    ),
    atolyeParagraflari: metinDizisi(b.atolyeParagraflari),
    cerceve,
    analiz: (b.analiz as RaporAnalizi | null) ?? null,
    metinKaynagi: "sablon",
  };
}

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
 * (a) Gözlem alanı puanlarını görüşme öncesi hatırlatma cümlelerine çevirir.
 *
 * Değer bantları: 1–2 destek, 3 dengeli, 4–5 güçlü. Cevap sırası korunur —
 * uzman hangi sırayla puanladıysa yorum da o sırada gelir. Cümleye kısa alan
 * adı gömülür ("… “dikkatini sürdürme” yönüyle …"); eski kayıtlarda kısa ad
 * olmadığı için soru cümlesinin kendisi kullanılır.
 */
export function gozlemYorumuUret(
  ogrenciIlkAdi: string,
  cevaplar: readonly GozlemCevabi[],
): string[] {
  // Ad burada YALIN hâlde: bu kalıpların yüklemi çocuğa ait ("… sergilemektedir",
  // "… ihtiyaç duymaktadır"), tamlayan eki alırsa cümle bozuluyordu
  // ("Ömer'in … sergilemektedir"). Atölye özetindeki kalıp bunun tersi —
  // orada özne oturum sayısı olduğu için `tamlayanEkiyle` doğru kalıyor.
  return cevaplar.map((cevap, sira) => {
    const alan = cumleyeGom(cevap.baslik ?? cevap.soruMetni);
    const kaliplar =
      cevap.deger >= 4
        ? YUKSEK_KALIPLARI
        : cevap.deger === 3
          ? ORTA_KALIPLARI
          : DUSUK_KALIPLARI;
    return dongu(kaliplar, sira)(ogrenciIlkAdi, `“${alan}”`);
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
    return ["Bu tarihe kadar değerlendirilmiş atölye oturumu bulunmamaktadır."];
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

  // Başlığı olan bulgular kısa başlığıyla anılır; soru cümlesi ("... mu?")
  // veli brifinde de düzyazıya gömülmeye uygun değil. Başlık Büyük Harfli
  // Kelimelerle yazıldığı için bütünüyle küçültülür.
  const bulgulariYaz = (bulgular: readonly Bulgu[], enFazla: number) =>
    bulgular
      .slice(0, enFazla)
      .map((bulgu) =>
        bulgu.baslik
          ? bulgu.baslik.trim().toLocaleLowerCase("tr-TR")
          : cumleyeGom(bulgu.soruMetni),
      )
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

// ---------------------------------------------------------------------------
// (c) Görüşme çerçevesi
// ---------------------------------------------------------------------------

/** Formda işaretlenen her şey — çerçeve bundan derlenir. */
export type VeliGorusmeSecimleri = {
  band: YasBandi;
  /** Bölüm 1 — mizaç/kişilik özellikleri. */
  genelAnahtarlari: readonly string[];
  /** Bölüm 2 — bilişsel güçlü yönler (CAS/WISC-IV alanları). */
  gucluAnahtarlari: readonly string[];
  /** Bölüm 4 — zorlandığı alanlar. */
  zorlanmaAnahtarlari: readonly string[];
  /** Bölüm 5 — bu dönem önerilen yönlendirmeler. */
  yonlendirmeler: readonly {
    tur: YonlendirmeTuru;
    etiket: string;
    not: string | null;
  }[];
};

const KAPANIS_ONERISI =
  "Bugün paylaştıklarınız için teşekkür ederim. Çocuğunuzu en iyi siz " +
  "tanıyorsunuz; bu gözlemler birlikte değerlendirdiğimizde daha anlam " +
  "kazanıyor. Sorularınız olursa her zaman ulaşabilirsiniz. Önümüzdeki " +
  "dönemde gelişimi birlikte takip etmeye devam edeceğiz.";

/**
 * (c) Formun işaretlerinden "görüşmede söylenecekler" çerçevesini derler.
 *
 * Kâğıt formdaki canlı özetin karşılığı. Hiçbir bölüm işaretlenmemişse boş
 * dizi döner — kapanış cümlesi de yazılmaz, çünkü içi boş bir çerçevenin
 * altında duran nazik kapanış, uzmana "hazırlandı" hissi verirdi.
 */
export function gorusmeCercevesiUret(
  secimler: VeliGorusmeSecimleri,
): CerceveBolumu[] {
  const bolumler: CerceveBolumu[] = [];
  const { band } = secimler;

  const basliklar = secimler.genelAnahtarlari
    .map((anahtar) => GENEL_OZELLIKLER[band][anahtar]?.baslik)
    .filter((x): x is string => Boolean(x));
  if (basliklar.length > 0) {
    bolumler.push({
      etiket: "GENEL PROFİL (giriş çerçevesi)",
      metin:
        `Gözlemlenen genel özellikler: ${basliklar.join(", ")}. Bu özellikler, ` +
        "çocuğun mizaç ve kişilik örüntüsüne dair ilk izlenimi yansıtmakta olup " +
        "etiketleme amacı taşımamaktadır.",
    });
  }

  const gucluCumleler = secimler.gucluAnahtarlari
    .map((anahtar) => GUCLU_YONLER[band][anahtar]?.cumle)
    .filter((x): x is string => Boolean(x));
  if (gucluCumleler.length > 0) {
    bolumler.push({
      etiket: "BİLİŞSEL GÜÇLÜ YÖN PROFİLİ (CAS/WISC-IV kaynaklı)",
      metin: gucluCumleler.join(" "),
    });
  }

  const zorlanmaYorumlari = secimler.zorlanmaAnahtarlari
    .map((anahtar) => ZORLANMA_ALANLARI[band][anahtar]?.yorum)
    .filter((x): x is string => Boolean(x));
  if (zorlanmaYorumlari.length > 0) {
    bolumler.push({
      etiket:
        "DESTEK ALANLARINDAKİ GÖZLEMLER (görüşmede nazikçe çerçevelenecek)",
      metin: zorlanmaYorumlari.join(" "),
    });
  }

  if (secimler.yonlendirmeler.length > 0) {
    const metin = secimler.yonlendirmeler
      .map((y) => (y.not ? `${y.etiket} (${y.not})` : y.etiket))
      .join(", ");
    bolumler.push({
      etiket: "YÖNLENDİRME KARARLARI (bu dönem kaydedilen)",
      metin: `${metin} yönlendirmesi bu dönem için değerlendirilmiş ve kayıt altına alınmıştır.`,
    });
  }

  if (bolumler.length > 0) {
    bolumler.push({ etiket: "KAPANIŞ ÖNERİSİ", metin: KAPANIS_ONERISI });
  }

  return bolumler;
}

// ---------------------------------------------------------------------------
// Kaydın form gövdesi (`ParentMeeting.formJson`)
// ---------------------------------------------------------------------------

/**
 * Görüşme formunun işaretleri ve serbest metinleri — brief'ten AYRI saklanır.
 *
 * Brief üretilmiş METİN, bu ise uzmanın verdiği KARAR. İkisi ayrı durur ki
 * metin sözlüğü ilerde revize edildiğinde eski kaydın hangi kutularının
 * işaretlendiği tartışmasız kalsın; başlıklar da o günkü hâliyle (`baslik`
 * alanları) donduğu için sözlükten silinen bir madde kaydı boşaltmaz.
 *
 * Yönlendirmeler burada DEĞİL, `ParentMeetingReferral` satırlarında —
 * öğrencinin dönemler arası yönlendirme geçmişi sorgulanabilir olmalı.
 */
export type VeliGorusmeFormu = {
  /** Görüşme anındaki dolmuş yaş; sonradan değişse de kayıt sabit kalır. */
  yas: number;
  band: YasBandi;
  /** Yaş 4–10 dışındaysa metinler en yakın banttan alındı demektir. */
  bandDisi: boolean;
  /** Bölüm 1 — işaretli mizaç özellikleri, `{anahtar, baslik}`. */
  genel: IsaretliMadde[];
  /** Bölüm 2 — işaretli bilişsel güçlü yönler. */
  guclu: IsaretliMadde[];
  /** Bölüm 4 — işaretli zorlanma alanları. */
  zorlanma: IsaretliMadde[];
  /** Bölüm 1 sonundaki serbest uzman gözlem notu. */
  gozlemNotu: string | null;
  /** Bölüm 2 sonundaki genel özet / ek notlar. */
  gucluOzeti: string | null;
  /** Bölüm 3 — atölye başına serbest gözlem. */
  atolyeNotlari: { atolye: string; not: string }[];
};

/** İşaretlenen madde; başlık kayıt anında donar (`questionTextSnapshot`). */
export type IsaretliMadde = { anahtar: string; baslik: string };

/** Kayıttan okunan `formJson`ı güvenle çevirir; eski kayıtlarda alan yok. */
export function veliFormuCozumle(ham: unknown): VeliGorusmeFormu | null {
  if (typeof ham !== "object" || ham === null) return null;
  const f = ham as Record<string, unknown>;
  if (typeof f.yas !== "number" || typeof f.band !== "string") return null;

  const maddeler = (deger: unknown): IsaretliMadde[] =>
    Array.isArray(deger)
      ? deger.filter(
          (x): x is IsaretliMadde =>
            typeof x === "object" &&
            x !== null &&
            typeof (x as Record<string, unknown>).anahtar === "string" &&
            typeof (x as Record<string, unknown>).baslik === "string",
        )
      : [];

  const metin = (deger: unknown): string | null =>
    typeof deger === "string" && deger.trim() !== "" ? deger : null;

  return {
    yas: f.yas,
    band: f.band as YasBandi,
    bandDisi: f.bandDisi === true,
    genel: maddeler(f.genel),
    guclu: maddeler(f.guclu),
    zorlanma: maddeler(f.zorlanma),
    gozlemNotu: metin(f.gozlemNotu),
    gucluOzeti: metin(f.gucluOzeti),
    atolyeNotlari: Array.isArray(f.atolyeNotlari)
      ? f.atolyeNotlari.filter(
          (x): x is { atolye: string; not: string } =>
            typeof x === "object" &&
            x !== null &&
            typeof (x as Record<string, unknown>).atolye === "string" &&
            typeof (x as Record<string, unknown>).not === "string",
        )
      : [],
  };
}

/**
 * Brief'in saklanacak gövdesi — `raporUret` deseninin veli görüşmesi karşılığı.
 *
 * `raporGirdisi` null gelebilir (öğrencinin hiç kaydı yok); o durumda atölye
 * bölümü tek "veri yok" cümlesidir ve analiz saklanmaz.
 */
export function veliBriefiUret(girdi: {
  ogrenciIlkAdi: string;
  cevaplar: readonly GozlemCevabi[];
  secimler: VeliGorusmeSecimleri;
  raporGirdisi: RaporGirdisi | null;
}): VeliBriefi {
  const analiz = girdi.raporGirdisi
    ? raporAnaliziUret(girdi.raporGirdisi)
    : null;

  return {
    gozlemParagraflari: gozlemYorumuUret(girdi.ogrenciIlkAdi, girdi.cevaplar),
    atolyeParagraflari: analiz
      ? atolyeOzetiMetniUret(analiz)
      : ["Bu tarihe kadar değerlendirilmiş atölye oturumu bulunmamaktadır."],
    cerceve: gorusmeCercevesiUret(girdi.secimler),
    analiz,
    metinKaynagi: "sablon",
  };
}
