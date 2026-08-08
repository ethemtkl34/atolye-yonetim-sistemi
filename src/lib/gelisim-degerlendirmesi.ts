import type { AssessmentPeriod } from "@/generated/prisma/enums";

/**
 * "Sosyal Duygusal Bilişsel Beceriler" testi — soru listesi ve zaman kuralları.
 *
 * Stajyer, kendisine atanmış her dönem öğrencisi için bu testi iki kez
 * doldurur: dönem ortasında ve dönem sonunda. Test atölye oturumlarına bağlı
 * değildir; kayıt (Enrollment) başına tutulur.
 *
 * Buradaki her fonksiyon SAF: veritabanı bilmez, tarih üretmez (bugünü
 * çağıran verir). Sorular kodda sabittir (`MINI_TEST_SORULARI` deseni);
 * cevap kaydı soru metnini kendi içinde taşıdığı için listeyi değiştirmek
 * geçmiş kayıtları bozmaz (`questionTextSnapshot` ilkesi).
 */

export type GelisimSorusu = {
  /** Kayıtta ve form alanı adında kullanılan kararlı kimlik. */
  anahtar: string;
  kategori: string;
  baslik: string;
  metin: string;
};

/** Kurumun karnesindeki (C-1 Yaz Grubu 2025-2026) 18 soru, üç gelişim alanı. */
export const GELISIM_SORULARI: readonly GelisimSorusu[] = [
  // Duygusal gelişim (7)
  {
    anahtar: "duygu-tanima",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Duygu Tanıma ve İfade Etme",
    metin:
      "Çocuk, kendi duygularını tanıyabiliyor ve doğru bir şekilde ifade edebiliyor mu?",
  },
  {
    anahtar: "duygu-duzenleme",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Duygu Düzenleme",
    metin:
      "Zorlayıcı durumlarda duygularını kontrol etme ve sakinleşme becerisi gösteriyor mu?",
  },
  {
    anahtar: "empati-gelisimi",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Empati Gelişimi",
    metin:
      "Başkalarının duygularını anlamaya ve empati kurmaya yönelik davranışlar sergiliyor mu?",
  },
  {
    anahtar: "oz-yeterlilik",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Öz Yeterlilik",
    metin:
      "Kendine güven duygusu, yeni görevleri deneme isteği ve başarma inancı nasıl?",
  },
  {
    anahtar: "bagimsizlik",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Bağımsızlık",
    metin:
      "Çocuk, bağımsız olarak sorun çözme ve karar verme becerileri sergiliyor mu?",
  },
  {
    anahtar: "bas-etme",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Baş Etme Stratejileri",
    metin: "Hayal kırıklıkları ve stresle nasıl başa çıkıyor?",
  },
  {
    anahtar: "olumlu-oz-algi",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Olumlu Öz Algı",
    metin: "Kendi hakkında olumlu bir görüş geliştirmiş mi?",
  },

  // Sosyal gelişim (5)
  {
    anahtar: "iletisim",
    kategori: "Sosyal Gelişim Alanları",
    baslik: "İletişim Becerileri",
    metin: "Diğer çocuklar ve yetişkinlerle etkili iletişim kurabiliyor mu?",
  },
  {
    anahtar: "is-birligi",
    kategori: "Sosyal Gelişim Alanları",
    baslik: "İş Birliği ve Paylaşma",
    metin:
      "Başkalarıyla iş birliği yapma ve eşyalarını paylaşma konusunda nasıl?",
  },
  {
    anahtar: "kurallara-uyum",
    kategori: "Sosyal Gelişim Alanları",
    baslik: "Kurallara Uyum",
    metin: "Sosyal ortamlarda grup kurallarına uyma becerisi nasıl?",
  },
  {
    anahtar: "sosyal-inisiyatif",
    kategori: "Sosyal Gelişim Alanları",
    baslik: "Sosyal İnisiyatif",
    metin:
      "Yeni arkadaşlıklar kurma ve sosyal etkileşim başlatma konusunda aktif mi?",
  },
  {
    anahtar: "uzlasma",
    kategori: "Sosyal Gelişim Alanları",
    baslik: "Problem Çözme ve Uzlaşma",
    metin:
      "Arkadaşlarıyla yaşadığı sorunları çözme ve uzlaşma yolları bulmada nasıl?",
  },

  // Bilişsel gelişim (6)
  {
    anahtar: "dikkat",
    kategori: "Bilişsel Gelişim Alanları",
    baslik: "Dikkat ve Konsantrasyon",
    metin:
      "Görevlerde dikkatini sürdürebiliyor mu, odaklanma süresi ne kadar?",
  },
  {
    anahtar: "bellek",
    kategori: "Bilişsel Gelişim Alanları",
    baslik: "Bellek ve Hatırlama",
    metin: "Bilgileri hafızasında tutma ve tekrar hatırlama becerisi nasıl?",
  },
  {
    anahtar: "problem-cozme",
    kategori: "Bilişsel Gelişim Alanları",
    baslik: "Problem Çözme Becerileri",
    metin:
      "Zorluklarla karşılaştığında yaratıcı ve analitik çözüm yolları bulabiliyor mu?",
  },
  {
    anahtar: "dil-gelisimi",
    kategori: "Bilişsel Gelişim Alanları",
    baslik: "Dil Gelişimi ve Anlama",
    metin: "Dil becerileri, kavrama ve yönergeleri anlama yeteneği nasıl?",
  },
  {
    anahtar: "mantiksal-dusunme",
    kategori: "Bilişsel Gelişim Alanları",
    baslik: "Mantıksal Düşünme",
    metin:
      "Olaylar arasında bağlantı kurma ve mantıksal düşünme becerisi ne seviyede?",
  },
  {
    anahtar: "planlama",
    kategori: "Bilişsel Gelişim Alanları",
    baslik: "Planlama ve Organizasyon",
    metin:
      "Görevleri planlayabilme ve sırayla yapabilme becerisi gelişmiş mi?",
  },
];

/** Kayıtta saklanan tek cevap satırı — soru alanları o günkü hâliyle donar. */
export type GelisimCevabi = {
  anahtar: string;
  kategori: string;
  baslik: string;
  soruMetni: string;
  /** 1–5; null = Değerlendirilemedi (puanlama ölçeğiyle aynı, §10.4). */
  deger: number | null;
};

export const DONEM_ETIKETLERI: Record<AssessmentPeriod, string> = {
  DONEM_ORTASI: "Dönem ortası",
  DONEM_SONU: "Dönem sonu",
};

export const GELISIM_DONEMLERI: readonly AssessmentPeriod[] = [
  "DONEM_ORTASI",
  "DONEM_SONU",
];

export type GelisimPenceresi = {
  /** Bugün itibarıyla doldurulabilir mi? */
  acik: boolean;
  /** Kapalıysa hangi tarihte açılacağı; hafta listesi boşsa null. */
  acilisTarihi: Date | null;
};

/**
 * Dönem ortası ve sonu pencerelerinin açılış zamanı.
 *
 * Kural `oturumPuanlanabilirMi` ile aynı ruhta: gözlenmemiş dönem
 * değerlendirilmez. Dönem ortası testi programın orta haftasının (10 haftada
 * 5. hafta) gününden itibaren, dönem sonu testi son haftanın gününden
 * itibaren doldurulabilir. Kapanış tarihi yok — geç kalınmış test her zaman
 * girilebilir (§10.5'in "son tarih koymuyoruz" ilkesi).
 *
 * Hafta listesi boş olan (takvimi silinmiş) grupta kilit uygulanmaz;
 * takvimsiz bir kaydın testini süresiz kilitlemek doldurmayı imkânsız kılardı.
 */
export function gelisimPencereleri(
  haftalar: readonly { weekNumber: number; date: Date }[],
  bugun: Date,
): Record<AssessmentPeriod, GelisimPenceresi> {
  if (haftalar.length === 0) {
    return {
      DONEM_ORTASI: { acik: true, acilisTarihi: null },
      DONEM_SONU: { acik: true, acilisTarihi: null },
    };
  }

  const sirali = [...haftalar].sort((a, b) => a.weekNumber - b.weekNumber);
  const ortaHafta = sirali[Math.ceil(sirali.length / 2) - 1];
  const sonHafta = sirali[sirali.length - 1];

  const pencere = (acilis: Date): GelisimPenceresi => ({
    acik: acilis.getTime() <= bugun.getTime(),
    acilisTarihi: acilis,
  });

  return {
    DONEM_ORTASI: pencere(ortaHafta.date),
    DONEM_SONU: pencere(sonHafta.date),
  };
}

export type GelisimDurumu = "KILITLI" | "BEKLIYOR" | "DOLDURULDU";

export const GELISIM_DURUM_ETIKETLERI: Record<
  GelisimDurumu,
  { etiket: string; rozet: "notr" | "olumlu" | "uyari" | "pasif" }
> = {
  KILITLI: { etiket: "Henüz açılmadı", rozet: "pasif" },
  BEKLIYOR: { etiket: "Doldurulmadı", rozet: "uyari" },
  DOLDURULDU: { etiket: "Dolduruldu", rozet: "olumlu" },
};

/** Tek bir dönem noktasının durum rozeti. */
export function gelisimDurumu(
  dolduruldu: boolean,
  pencere: GelisimPenceresi,
): GelisimDurumu {
  if (dolduruldu) return "DOLDURULDU";
  return pencere.acik ? "BEKLIYOR" : "KILITLI";
}

/**
 * Kayıttan okunan `answersJson` değerini güvenle `GelisimCevabi[]`ya çevirir.
 *
 * Veritabanındaki CHECK yalnızca "dizi olsun" der; satırların şekli burada
 * süzülür. Tanınmayan satırlar sessizce atlanır — eski bir kayıt biçimi
 * ekranı düşürmemeli.
 */
export function gelisimCevaplariCozumle(ham: unknown): GelisimCevabi[] {
  if (!Array.isArray(ham)) return [];

  return ham.filter((satir): satir is GelisimCevabi => {
    if (typeof satir !== "object" || satir === null) return false;
    const s = satir as Record<string, unknown>;
    return (
      typeof s.anahtar === "string" &&
      typeof s.kategori === "string" &&
      typeof s.baslik === "string" &&
      typeof s.soruMetni === "string" &&
      (s.deger === null || typeof s.deger === "number")
    );
  });
}
