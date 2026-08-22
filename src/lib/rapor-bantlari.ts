/**
 * Rapor kademe (bant) motoru — §11.
 *
 * Rapor artık veliye ham puan göstermiyor. Bir ortalama üç kademeden birine
 * düşer ve rapora yalnızca o kademenin adı, rengi ve göstergesi basılır.
 * Sayının gizlenmesi bilinçli: "Bilişsel 2,4" gibi bir değer veliye tek
 * başına bir şey anlatmıyor ama çocuğa yapıştırılan bir not gibi okunuyor.
 *
 * ERİŞİLEBİLİRLİK: kademe İKİ kanaldan anlatılır — renk ve dolu segment
 * sayısı. Renk körlüğü olan bir okuyucu da, gri basılmış bir çıktı da
 * kademeyi segment sayısından okuyabilir. Bu yüzden `dolu` alanı yalnızca
 * görsel bir süs değil, bilginin ikinci taşıyıcısıdır.
 *
 * Bütün fonksiyonlar saf: veritabanı bilmezler, tarih üretmezler.
 */

export type Kademe = "YUKSEK" | "ORTALAMA" | "DUSUK";

export type BantBilgisi = {
  kademe: Kademe;
  /** Rapora basılan etiket. */
  etiket: string;
  /** Üç segmentin kaçının dolu olduğu — rengin yanındaki ikinci kanal. */
  dolu: 1 | 2 | 3;
  /** Metin ve segment rengi (beyaz üstünde en az 4,5:1 kontrast). */
  renk: string;
  /** Etiket şeridinin zemin rengi. */
  zemin: string;
};

/**
 * Kademelerin temel tanımı: renk, segment sayısı ve VARSAYILAN etiket.
 *
 * Etiketler artık panelden değiştirilebiliyor (`RaporAyari.etiketDusuk` vb.);
 * buradaki adlar ayar girilmemişken ve ayar alanı taşımayan eski raporlarda
 * geçerli olan değerlerdir. Renk ve segment sayısı ayara açık değil — ikisi
 * de kademenin ikinci okuma kanalı (bkz. dosya başı).
 */
export const KADEMELER: Record<Kademe, BantBilgisi> = {
  YUKSEK: {
    kademe: "YUKSEK",
    etiket: "Yüksek",
    dolu: 3,
    renk: "#15803d",
    zemin: "#dcfce7",
  },
  ORTALAMA: {
    kademe: "ORTALAMA",
    etiket: "Ortalama",
    dolu: 2,
    renk: "#b45309",
    zemin: "#fef3c7",
  },
  DUSUK: {
    kademe: "DUSUK",
    etiket: "Düşük",
    dolu: 1,
    renk: "#b91c1c",
    zemin: "#fee2e2",
  },
};

// ---------------------------------------------------------------------------
// Eşikler
// ---------------------------------------------------------------------------

/**
 * Raporun sayıdan kademeye geçerken kullandığı bütün ölçütler.
 *
 * Bu değerler eskiden bu dosyada sabitti. Kurum bir ortalamanın hangi
 * noktadan sonra "Yüksek" sayılacağını, kaç kişilik grupta akran kıyası
 * yapılabileceğini ve en alt kademeyi veliye nasıl adlandıracağını panelden
 * değiştirebiliyor (`RaporAyari` tablosu, `rapor-ayarlari.ts`).
 *
 * Fonksiyonlar bunu PARAMETRE olarak alır ve varsayılanı koddadır: dosya saf
 * kalır, testler eşik geçirmeden çalışmaya devam eder ve ayar tablosu boşken
 * sistem eski davranışını sürdürür.
 */
export type RaporEsikleri = {
  /** Atölye ilgi/başarı: bu değer ve üstü Yüksek. */
  atolyeYuksek: number;
  /** Atölye ilgi/başarı: bu değerin altı Düşük. */
  atolyeDusuk: number;
  /** Gelişim alanı: öğrenci–grup farkı bu kadarsa Yüksek, eksisiyse Düşük. */
  gelisimFark: number;
  /**
   * Aynı öğrencinin dönem ortası ile dönem sonu ölçümü arasındaki farkın
   * "belirgin ilerleme" sayılma eşiği. `gelisimFark` akran kıyasını ölçer,
   * bu öğrencinin kendi değişimini — ikisi ayrı sorular.
   */
  gelisimIlerleme: number;
  /** İlgi–başarı farkının "belirgin asimetri" sayılma eşiği. */
  asimetri: number;
  /**
   * Akran kıyası için grupta değerlendirilmiş en az öğrenci sayısı (raporun
   * öğrencisi dahil). Bu dosya kıyası kendisi yapmaz; eşiği `rapor-govdesi-verisi.ts`
   * uygular ama tek ölçüt kümesi dağılmasın diye tanım burada durur.
   */
  kiyasAsgariOgrenci: number;
  /** Kademelerin veliye yazılan adları. */
  etiketler: Record<Kademe, string>;
};

/**
 * Ayar tablosu boşken geçerli olan değerler.
 *
 * Gelişim alanları GRUPLA KIYASLANIR: örnek raporun bu bölümünde öğrenci
 * çubuğunun yanında grup ortalaması çubuğu duruyor ve metin "yaşıtlarının
 * üzerinde" diyor; yani kademe mutlak puandan değil, gruba göre farktan
 * çıkıyor. 4,2 puan zayıf bir grupta yüksek, güçlü bir grupta ortalamadır.
 *
 * Atölye ilgi ve başarı düzeyleri ise KIYASLANMAZ. Örnek rapor bunu açıkça
 * yazıyor: "Değerlendirme her öğrenci özelinde sadece öğrencinin kendi ilgi
 * düzeyini göstermekte olup akran grubu veya sınıf içi kıyaslamayı
 * kapsamamaktadır." Bu yüzden orada 1–5 ölçeğinin mutlak eşikleri kullanılır.
 *
 * Asimetride bir tam kademe farkı aranır: 0,3–0,4'lük oynamalar ölçüm
 * gürültüsü sayılır ve veliye "asimetri" diye sunulmaz.
 */
export const VARSAYILAN_ESIKLER: RaporEsikleri = {
  atolyeYuksek: 4.0,
  atolyeDusuk: 3.0,
  gelisimFark: 0.25,
  gelisimIlerleme: 0.3,
  asimetri: 0.75,
  kiyasAsgariOgrenci: 3,
  etiketler: {
    YUKSEK: KADEMELER.YUKSEK.etiket,
    ORTALAMA: KADEMELER.ORTALAMA.etiket,
    DUSUK: KADEMELER.DUSUK.etiket,
  },
};

/**
 * Kademenin, seçili etiket adıyla birlikte bant bilgisi.
 *
 * Renk, segment sayısı ve zemin kurumun ayarına açık değil — bunlar
 * erişilebilirlik sözü (bkz. dosya başı) ve kademe sırasının görsel dili.
 * Değişebilen tek şey ADI.
 */
function bantEtiketli(kademe: Kademe, esikler: RaporEsikleri): BantBilgisi {
  const temel = KADEMELER[kademe];
  const etiket = esikler.etiketler[kademe]?.trim() || temel.etiket;
  return etiket === temel.etiket ? temel : { ...temel, etiket };
}

// ---------------------------------------------------------------------------
// Bant hesabı
// ---------------------------------------------------------------------------

/**
 * Gelişim alanının kademesi — öğrencinin ortalaması grup ortalamasıyla
 * karşılaştırılır.
 *
 * Grup ortalaması yoksa (öğrenci grubun tek değerlendirilmiş üyesiyse)
 * kıyas yapılamaz; bu durumda atölye eşikleriyle mutlak değerlendirmeye
 * düşülür. Kıyas yokluğunu "ortalama" diye yazmak, veriden çıkmayan bir
 * sonuç üretmek olurdu (§11.3).
 */
export function gelisimBandi(
  ogrenciOrtalamasi: number | null,
  grupOrtalamasi: number | null,
  esikler: RaporEsikleri = VARSAYILAN_ESIKLER,
): BantBilgisi | null {
  if (ogrenciOrtalamasi === null) return null;
  if (grupOrtalamasi === null) return atolyeBandi(ogrenciOrtalamasi, esikler);

  const fark = ogrenciOrtalamasi - grupOrtalamasi;
  if (fark >= esikler.gelisimFark) return bantEtiketli("YUKSEK", esikler);
  if (fark <= -esikler.gelisimFark) return bantEtiketli("DUSUK", esikler);
  return bantEtiketli("ORTALAMA", esikler);
}

/**
 * Atölye ilgi/başarı kademesi — mutlak puana göre, kıyas yok.
 */
export function atolyeBandi(
  ortalama: number | null,
  esikler: RaporEsikleri = VARSAYILAN_ESIKLER,
): BantBilgisi | null {
  if (ortalama === null) return null;
  if (ortalama >= esikler.atolyeYuksek) return bantEtiketli("YUKSEK", esikler);
  if (ortalama < esikler.atolyeDusuk) return bantEtiketli("DUSUK", esikler);
  return bantEtiketli("ORTALAMA", esikler);
}

// ---------------------------------------------------------------------------
// Metin katmanı
// ---------------------------------------------------------------------------

/**
 * §11.2 — Gelişim alanının veliye yazılan değerlendirme cümlesi.
 *
 * Bu cümleler kasten ŞABLON, yapay zekâ üretimi değil. Veliye giden en
 * hassas satırlar bunlar ve her öğrencide aynı kalıptan çıkmaları hem
 * tutarlılık hem de denetlenebilirlik sağlıyor: hangi puanın hangi cümleyi
 * ürettiği tek bakışta görülüyor.
 *
 * Hiçbir kademede "altında", "geride" veya "yetersiz" geçmez; en alt kademe
 * bile gelişimin sürdüğünü söyleyip desteğe işaret eder.
 */
export function gelisimCumlesi(
  bant: BantBilgisi,
  alanAdi: string,
  kazanimOzeti: string,
  kiyasliMi: boolean,
): string {
  const giris = `Atölye kapsamında ${kazanimOzeti} gibi ${alanAdi} değerlendirildiğinde`;

  // Kıyas yapılamadığında "yaşıtlarının üzerinde" denemez — ortada bir
  // yaşıt ölçümü yoktur. Cümle o zaman öğrencinin kendi düzeyini anlatır.
  if (!kiyasliMi) {
    switch (bant.kademe) {
      case "YUKSEK":
        return `${giris} öğrencinin bu alanda güçlü bir gelişim gösterdiği görülmektedir.`;
      case "ORTALAMA":
        return `${giris} öğrencinin bu alanda gelişimini dengeli biçimde sürdürdüğü görülmektedir.`;
      case "DUSUK":
        return `${giris} öğrencinin bu alanda gelişimini sürdürdüğü; ev ve okul ortamındaki destekleyici çalışmaların katkı sağlayacağı değerlendirilmektedir.`;
    }
  }

  switch (bant.kademe) {
    case "YUKSEK":
      return `${giris} öğrencinin gelişimi yaşıtlarının üzerinde ilerlemektedir.`;
    case "ORTALAMA":
      return `${giris} öğrencinin gelişimi yaşıtlarıyla benzer bir düzeyde ilerlemektedir.`;
    case "DUSUK":
      return `${giris} öğrencinin bu alandaki gelişimi sürmekte olup desteklenmesinin faydalı olacağı değerlendirilmektedir.`;
  }
}

/**
 * §11.2 — Dönem ortası ile dönem sonu ölçümü arasındaki değişim.
 *
 * Stajyer aynı 18 soruluk formu dönemde İKİ KEZ dolduruyor; sistem bugüne
 * kadar yalnızca dönem sonunu okuyup ilk ölçümü hiç kullanmıyordu. İki nokta
 * arasındaki fark, tek bir düzey bildirmekten daha çok şey söyler: aynı
 * "Ortalama" kademesi, ilerleyerek gelinmişse başka bir haberdir.
 *
 * YÖN ÜÇE AYRILIR ve hiçbirinde "gerileme" denmez. Aradaki fark ölçüm
 * gürültüsü de olabilir (iki farklı haftada, farklı günlerde doldurulmuş iki
 * form); veliye "çocuğunuz geriledi" demek veriden çıkmayan bir sonuç olurdu
 * (§11.3). Düşüş "dalgalanma" olarak, desteğe işaret ederek yazılır.
 *
 * Eşiğin altındaki fark DEĞİŞİM SAYILMAZ ve "düzeyini korudu" olarak
 * anlatılır — sıfır fark ile 0,1'lik fark veli için aynı şeydir.
 */
export type GelisimDegisimi = {
  yon: "ILERLEME" | "KORUNDU" | "DALGALANMA";
  /** Dönem sonu − dönem ortası; işaretli. */
  fark: number;
  cumle: string;
};

export function gelisimDegisimi(
  ortaOrtalamasi: number | null,
  sonOrtalamasi: number | null,
  alanAdi: string,
  esikler: RaporEsikleri = VARSAYILAN_ESIKLER,
): GelisimDegisimi | null {
  // İki ölçümden biri yoksa değişim diye bir şey yok; bölüm hiç basılmaz.
  if (ortaOrtalamasi === null || sonOrtalamasi === null) return null;

  const fark = sonOrtalamasi - ortaOrtalamasi;

  if (fark >= esikler.gelisimIlerleme) {
    return {
      yon: "ILERLEME",
      fark,
      cumle: `Dönem ortasındaki değerlendirmeye göre ${alanAdi} alanında belirgin bir ilerleme kaydedilmiştir.`,
    };
  }

  if (fark <= -esikler.gelisimIlerleme) {
    return {
      yon: "DALGALANMA",
      fark,
      cumle: `Dönem ortasındaki değerlendirmeye göre ${alanAdi} alanında bir dalgalanma gözlenmiştir; bu alanın önümüzdeki dönemde de desteklenmesinin faydalı olacağı değerlendirilmektedir.`,
    };
  }

  // Cümle alan adıyla BAŞLAMAZ: alan adları küçük harfle geliyor ("duygusal
  // beceriler") ve cümle küçük harfle açılıyordu. Üç yön de aynı kalıpla,
  // "Dönem ortası..." ile başlar.
  return {
    yon: "KORUNDU",
    fark,
    cumle: `Dönem ortasından bu yana ${alanAdi} alanındaki düzeyini korumuştur.`,
  };
}

/**
 * §11.2 — İlgi ve başarı düzeyleri arasındaki asimetrinin yorumu.
 *
 * Örnek raporda bu açıklama herkeste aynı sabit metindi ve hangi atölyeyi
 * kastettiği yazmıyordu. Sistem farkı zaten hesaplayabildiği için atölyeyi
 * ismen söylüyoruz; genel bir uyarı yerine okunabilir bir bulgu oluyor.
 *
 * Eşik `RaporEsikleri.asimetri` ile yönetilir (varsayılan 0,75 — bir tam
 * kademe farkı): 0,3–0,4'lük oynamalar ölçüm gürültüsü sayılır ve veliye
 * "asimetri" diye sunulmaz.
 */
export type Asimetri = {
  atolyeAdi: string;
  yon: "ILGI_YUKSEK" | "BASARI_YUKSEK";
  cumle: string;
};

export function asimetriBul(
  atolyeler: readonly {
    atolyeAdi: string;
    ilgi: number | null;
    basari: number | null;
  }[],
  esikler: RaporEsikleri = VARSAYILAN_ESIKLER,
): Asimetri[] {
  const bulgular: Asimetri[] = [];

  for (const atolye of atolyeler) {
    if (atolye.ilgi === null || atolye.basari === null) continue;

    const fark = atolye.ilgi - atolye.basari;
    if (Math.abs(fark) < esikler.asimetri) continue;

    if (fark > 0) {
      bulgular.push({
        atolyeAdi: atolye.atolyeAdi,
        yon: "ILGI_YUKSEK",
        cumle: `${atolye.atolyeAdi} çalışmalarına ilgisi belirgin biçimde yüksek olmakla birlikte, kazanımlara ulaşma düzeyi bu ilgiyle aynı oranda ilerlememiştir; bu alanda beceri desteği sağlanmasının öğrenciyi ilgisinden uzaklaştırmadan ilerletebileceği değerlendirilmektedir.`,
      });
    } else {
      bulgular.push({
        atolyeAdi: atolye.atolyeAdi,
        yon: "BASARI_YUKSEK",
        cumle: `${atolye.atolyeAdi} çalışmalarında kazanımlara ulaşma düzeyi yüksek olmakla birlikte ilgisi aynı düzeyde seyretmemiştir; bu alanda sürekliliğin desteklenmesinin ilgi kaybını önleyebileceği değerlendirilmektedir.`,
      });
    }
  }

  return ayniYonluleriBirlestir(bulgular);
}

/**
 * Aynı yöndeki bulgular 3 ve daha fazla atölyede tekrarlıyorsa tek cümlede
 * birleştirilir. Beş atölye için kelimesi kelimesine aynı cümlenin beş kez
 * basılması velide "şablon" hissi bırakıyordu (veli incelemesi bulgusu);
 * 1-2 atölyelik bulgular atölyeye özgü kaldıkları için ayrı yazılmayı
 * sürdürür.
 */
function ayniYonluleriBirlestir(bulgular: Asimetri[]): Asimetri[] {
  const sonuc: Asimetri[] = [];

  for (const yon of ["ILGI_YUKSEK", "BASARI_YUKSEK"] as const) {
    const grup = bulgular.filter((b) => b.yon === yon);
    if (grup.length < 3) {
      sonuc.push(...grup);
      continue;
    }

    const adlar = grup.map((b) => b.atolyeAdi.replace(/ Atölyesi$/u, ""));
    const liste = `${adlar.slice(0, -1).join(", ")} ve ${adlar.at(-1)}`;
    sonuc.push({
      atolyeAdi: liste,
      yon,
      cumle:
        yon === "ILGI_YUKSEK"
          ? `${liste} atölyelerinin tümünde ilgisi belirgin biçimde yüksek olmakla birlikte, kazanımlara ulaşma düzeyi bu ilgiyle aynı oranda ilerlememiştir; bu alanlarda beceri desteği sağlanmasının öğrenciyi ilgisinden uzaklaştırmadan ilerletebileceği değerlendirilmektedir.`
          : `${liste} atölyelerinin tümünde kazanımlara ulaşma düzeyi yüksek olmakla birlikte ilgisi aynı düzeyde seyretmemiştir; bu alanlarda sürekliliğin desteklenmesinin ilgi kaybını önleyebileceği değerlendirilmektedir.`,
    });
  }

  return sonuc;
}
