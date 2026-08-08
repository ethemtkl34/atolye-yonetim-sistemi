/**
 * "Atölyeler ve İçerikleri Hakkında" paragrafının üretimi — §11.2.
 *
 * Bu metin ÖĞRENCİYE ÖZEL DEĞİL: bir programın bir atölyesinin o dönem
 * boyunca ne işlediğini anlatır. Program × atölye başına bir kez üretilir ve
 * o programdaki bütün öğrencilerin raporunda aynen görünür.
 *
 * Bu dosya SAF: ağ çağrısı ve ortam değişkeni bilmez, bu yüzden testten
 * doğrudan çağrılabilir. Çağrıyı yapan katman `atolye-icerigi.ts`.
 *
 * Girdisi tamamen kurumun kendi verisi: haftalık müfredat maddeleri ve o
 * atölyenin ölçtüğü beceri başlıkları. Modelin işi bu maddeleri akıcı bir
 * paragrafa çevirmek; konu eklemek değil.
 */

export type AtolyeIcerikGirdisi = {
  atolyeAdi: string;
  atolyeAciklamasi: string | null;
  haftalar: readonly { hafta: number; baslik: string; aciklama: string | null }[];
  /** Atölyenin puanlama sorularının kısa başlıkları — desteklenen beceriler. */
  beceriBasliklari: readonly string[];
};

/**
 * Modelin uyacağı kurallar.
 *
 * En sert kural uydurma yasağı: paragraf veliye gidiyor ve içindeki her
 * etkinlik adı, kurumun o dönem gerçekten yaptığını iddia ediyor. Modelin
 * "bilim atölyesinde genelde şunlar yapılır" bilgisiyle boşluk doldurması,
 * kurumu yapmadığı bir işin altına imza attırır.
 */
export const TALIMAT = `Sen bir eğitim kurumunun dönem sonu veli raporunu yazan editörsün.

GÖREVİN: Sana verilen haftalık müfredat maddelerini, atölyenin dönem boyunca ne yaptığını anlatan TEK bir paragrafa çevirmek.

KURALLAR:
- Yalnızca sana verilen müfredat maddelerindeki konuları yaz. Verilmeyen hiçbir etkinlik, konu, materyal veya kavram ekleme. Genel bilginle boşluk doldurma.
- Paragraf 110-150 kelime olsun. Tek paragraf, madde işareti yok, başlık yok.
- Üçüncü çoğul şahıs ve geçmiş zaman kullan: "öğrenciler ... deneyimlemiştir", "... ele alınmıştır".
- Tek bir öğrenciden söz etme; bu metin bütün gruba ait.
- Paragrafı atölyenin adıyla başlat: "<Atölye adı> sürecinde öğrenciler;"
- Son cümlede, sana verilen beceri başlıklarından hangilerinin desteklendiğini doğal bir dille söyle. Beceri adlarını olduğu gibi liste hâlinde sıralama, cümleye yedir.
- Dil profesyonel, sıcak ve veliye sunulabilir olsun. Abartılı övgü ve pazarlama dili kullanma.
- Yalnızca paragrafı döndür; açıklama, giriş cümlesi veya tırnak ekleme.`;

/**
 * Müfredat maddelerini modele verilecek girdiye çevirir.
 *
 * Haftalar numarasıyla yazılıyor: model konuların bir sıra izlediğini görsün
 * ve paragrafı bu akışa göre kursun. Açıklaması boş olan haftalar yalnızca
 * başlıkla giriyor — boş bir satır, modelin oraya bir şey uydurması için
 * davetiye olur.
 */
export function atolyeIcerikGirdisiYaz(girdi: AtolyeIcerikGirdisi): string {
  const satirlar: string[] = [`ATÖLYE: ${girdi.atolyeAdi}`];

  if (girdi.atolyeAciklamasi) {
    satirlar.push(`TANIM: ${girdi.atolyeAciklamasi}`);
  }

  satirlar.push("", "HAFTALIK MÜFREDAT:");
  for (const hafta of girdi.haftalar) {
    const aciklama = hafta.aciklama?.trim();
    satirlar.push(
      aciklama
        ? `${hafta.hafta}. hafta — ${hafta.baslik}: ${aciklama}`
        : `${hafta.hafta}. hafta — ${hafta.baslik}`,
    );
  }

  if (girdi.beceriBasliklari.length > 0) {
    satirlar.push(
      "",
      "BU ATÖLYEDE DEĞERLENDİRİLEN BECERİLER:",
      girdi.beceriBasliklari.join(", "),
    );
  }

  return satirlar.join("\n");
}

/**
 * Müfredatın paragraf üretmeye yetip yetmediği.
 *
 * Canlıdaki girdilerin bir kısmı "3. hafta uygulaması — … etkinlik ve gözlem
 * konuları" gibi yer tutucu. Bunlardan üretilen paragraf, hiçbir şey
 * söylemeyen ama bir şey söylüyormuş gibi duran bir metin olur; böyle bir
 * metni veliye göndermek, bölümü hiç basmamaktan kötüdür.
 */
export function mufredatYeterliMi(
  haftalar: readonly { baslik: string; aciklama: string | null }[],
): boolean {
  const dolu = haftalar.filter((hafta) => {
    const baslik = hafta.baslik.trim();
    // "1. hafta uygulaması" gibi, hafta numarasından başka bilgi taşımayan
    // başlıklar sayılmaz.
    const yerTutucu = /^\d+\.\s*hafta\s+uygulamas/i.test(baslik);
    return !yerTutucu && (baslik.length > 0 || (hafta.aciklama ?? "").length > 0);
  });

  return dolu.length >= 3;
}
