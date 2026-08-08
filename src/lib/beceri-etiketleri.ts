/**
 * Öneri motorunun ortak beceri sözcüğü.
 *
 * İki taraf birbirini bulmak zorunda: bir yanda öğrencinin puanlarından çıkan
 * güçlü/desteklenecek alanlar (atölyeye göre değişen soru başlıkları —
 * "Gözlem ve Analiz Yeteneği", "Bilimsel Düşünme Becerisi"…), diğer yanda
 * ürün kataloğu. İkisini doğrudan eşleştirmek imkânsız; bu yüzden her iki
 * taraf da önce buradaki kapalı etiket listesine indirgenir.
 *
 * Liste kasten kısa: çok sayıda ince etiket, eşleşmeyi kırılganlaştırır ve
 * "hiç ürün bulunamadı" sonucunu yaygınlaştırır.
 */
export const BECERI_ETIKETLERI = [
  "akil-yurutme",
  "problem-cozme",
  "stratejik-dusunme",
  "sira-disi-dusunme",
  "odaklanma",
  "isitsel-dikkat",
  "islemleme-hizi",
  "ince-motor",
  "is-birligi",
  "iletisim",
  "duygu-yonetimi",
  "empati",
  "oz-guven",
  "sorumluluk",
] as const;

export type BeceriEtiketi = (typeof BECERI_ETIKETLERI)[number];

export const BECERI_ADLARI: Record<BeceriEtiketi, string> = {
  "akil-yurutme": "Akıl Yürütme",
  "problem-cozme": "Problem Çözme",
  "stratejik-dusunme": "Stratejik Düşünme",
  "sira-disi-dusunme": "Sıra Dışı Düşünme",
  odaklanma: "Odaklanma ve Konsantrasyon",
  "isitsel-dikkat": "İşitsel Dikkat",
  "islemleme-hizi": "İşlemleme Hızı",
  "ince-motor": "İnce Motor Beceriler",
  "is-birligi": "İş Birliği",
  iletisim: "İletişim",
  "duygu-yonetimi": "Duyguları Yönetme",
  empati: "Empati",
  "oz-guven": "Öz Güven",
  sorumluluk: "Sorumluluk",
};

export type GelisimAlani = "DUYGUSAL" | "SOSYAL" | "BILISSEL";

/** Her etiketin hangi gelişim alanına düştüğü. */
export const ETIKET_ALANLARI: Record<BeceriEtiketi, GelisimAlani> = {
  "akil-yurutme": "BILISSEL",
  "problem-cozme": "BILISSEL",
  "stratejik-dusunme": "BILISSEL",
  "sira-disi-dusunme": "BILISSEL",
  odaklanma: "BILISSEL",
  "isitsel-dikkat": "BILISSEL",
  "islemleme-hizi": "BILISSEL",
  "ince-motor": "BILISSEL",
  "is-birligi": "SOSYAL",
  iletisim: "SOSYAL",
  "duygu-yonetimi": "DUYGUSAL",
  empati: "DUYGUSAL",
  "oz-guven": "DUYGUSAL",
  sorumluluk: "SOSYAL",
};

/**
 * Serbest bir beceri/soru başlığını etikete indirger.
 *
 * Eşleşme anahtar kelime üzerinden yapılır çünkü kaynak metinler kurum
 * tarafından yazılıyor ve zamanla değişiyor: "Gözlem ve Analiz Yeteneği",
 * "Bilimsel Düşünme Becerisi", "Dikkat ve Konsantrasyon"… Sabit bir eşleme
 * tablosu her yeni soruda bozulurdu.
 *
 * Hiçbir kelime tutmazsa `null` döner — bu, o başlık için ürün ÖNERİLMEMESİ
 * demektir. Zorlama bir eşleşme, çocuğa uymayan bir ürünün veliye
 * önerilmesinden iyidir.
 */
const ANAHTAR_KELIMELER: [BeceriEtiketi, readonly string[]][] = [
  // Sıra ÖNEMLİ: ilk tutan kazanır. Dar ve tekanlamlı kelimeler önce,
  // "dikkat" gibi geniş kelimeler sonra gelir.
  ["isitsel-dikkat", ["işitsel", "yönergeleri anlama"]],
  ["empati", ["empati"]],
  ["duygu-yonetimi", ["duygu", "öfke", "baş etme", "sakinleş"]],
  ["oz-guven", ["öz algı", "öz güven", "özgüven", "öz yeterlilik", "kendine güven", "bağımsız", "azim"]],
  ["sorumluluk", ["sorumluluk", "kural", "yardımlaş", "yardımsever", "saygı", "görev"]],
  ["is-birligi", ["iş birliği", "işbirliği", "takım", "grup", "paylaş", "uzlaşma", "sosyal etkileşim"]],
  ["iletisim", ["iletişim", "ifade", "anlatım", "dil gelişimi", "dinleme", "sosyal inisiyatif"]],
  ["stratejik-dusunme", ["strateji", "planlama", "organizasyon", "hamle"]],
  ["sira-disi-dusunme", ["sıra dışı", "yaratıcı", "özgün", "hayal", "tasarım", "esnek", "farklı çözüm", "estetik", "üretici", "üreticilik", "yenilikçi", "inovasyon"]],
  ["problem-cozme", ["problem çözme", "hipotez", "deneme", "kodlama", "programlama"]],
  ["islemleme-hizi", ["hız", "işlemleme", "çabuk"]],
  ["ince-motor", ["motor", "el-göz", "el becerisi", "koordinasyon"]],
  ["odaklanma", ["dikkat", "konsantrasyon", "odak", "sabır", "süreç takibi", "bellek"]],
  ["akil-yurutme", ["mantık", "akıl yürütme", "muhakeme", "analiz", "kavram", "neden-sonuç", "gözlem", "bilimsel düşünme", "kritik düşünme", "algoritmik düşünme", "karar verme", "bilimsel yöntem", "bilimsel süreçleri"]],
];

export function beceriEtiketiCikar(baslik: string): BeceriEtiketi | null {
  const metin = baslik.toLocaleLowerCase("tr-TR");
  for (const [etiket, kelimeler] of ANAHTAR_KELIMELER) {
    if (kelimeler.some((kelime) => metin.includes(kelime))) return etiket;
  }
  return null;
}
