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
 * Kademelerin tek tanımı. Etiket metnini değiştirmek isteyen buraya
 * dokunur; "Düşük" yerine "Gelişmekte" gibi daha yumuşak bir dil tercih
 * edilirse tek satır yeter, eşikler ve renkler etkilenmez.
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
 * Gelişim alanları (Duygusal / Sosyal / Bilişsel) GRUPLA KIYASLANIR.
 *
 * Örnek raporun bu bölümünde öğrenci çubuğunun yanında grup ortalaması
 * çubuğu duruyor ve metin "yaşıtlarının üzerinde" diyor; yani kademe mutlak
 * puandan değil, gruba göre farktan çıkıyor. 4,2 puan zayıf bir grupta
 * yüksek, güçlü bir grupta ortalamadır.
 */
const GELISIM_YUKSEK_FARKI = 0.25;
const GELISIM_DUSUK_FARKI = -0.25;

/**
 * Atölye ilgi ve başarı düzeyleri KIYASLANMAZ.
 *
 * Örnek rapor bunu açıkça yazıyor: "Değerlendirme her öğrenci özelinde
 * sadece öğrencinin kendi ilgi düzeyini göstermekte olup akran grubu veya
 * sınıf içi kıyaslamayı kapsamamaktadır." Bu yüzden burada 1–5 ölçeğinin
 * kendi mutlak eşikleri kullanılır.
 */
const ATOLYE_YUKSEK_ESIGI = 4.0;
const ATOLYE_DUSUK_ESIGI = 3.0;

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
): BantBilgisi | null {
  if (ogrenciOrtalamasi === null) return null;
  if (grupOrtalamasi === null) return atolyeBandi(ogrenciOrtalamasi);

  const fark = ogrenciOrtalamasi - grupOrtalamasi;
  if (fark >= GELISIM_YUKSEK_FARKI) return KADEMELER.YUKSEK;
  if (fark <= GELISIM_DUSUK_FARKI) return KADEMELER.DUSUK;
  return KADEMELER.ORTALAMA;
}

/**
 * Atölye ilgi/başarı kademesi — mutlak puana göre, kıyas yok.
 */
export function atolyeBandi(ortalama: number | null): BantBilgisi | null {
  if (ortalama === null) return null;
  if (ortalama >= ATOLYE_YUKSEK_ESIGI) return KADEMELER.YUKSEK;
  if (ortalama < ATOLYE_DUSUK_ESIGI) return KADEMELER.DUSUK;
  return KADEMELER.ORTALAMA;
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
 * §11.2 — İlgi ve başarı düzeyleri arasındaki asimetrinin yorumu.
 *
 * Örnek raporda bu açıklama herkeste aynı sabit metindi ve hangi atölyeyi
 * kastettiği yazmıyordu. Sistem farkı zaten hesaplayabildiği için atölyeyi
 * ismen söylüyoruz; genel bir uyarı yerine okunabilir bir bulgu oluyor.
 *
 * Eşik olarak bir tam kademe farkı aranır: 0,3–0,4'lük oynamalar ölçüm
 * gürültüsü sayılır ve veliye "asimetri" diye sunulmaz.
 */
const ASIMETRI_ESIGI = 0.75;

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
): Asimetri[] {
  const bulgular: Asimetri[] = [];

  for (const atolye of atolyeler) {
    if (atolye.ilgi === null || atolye.basari === null) continue;

    const fark = atolye.ilgi - atolye.basari;
    if (Math.abs(fark) < ASIMETRI_ESIGI) continue;

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

  return bulgular;
}
