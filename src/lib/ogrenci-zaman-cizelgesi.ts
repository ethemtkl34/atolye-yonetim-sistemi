/**
 * §6.5 — Öğrencinin zaman çizelgesi (28 Eylül 2026).
 *
 * Profil sayfasında on iki kart var ve hepsi TEK kategorilik: randevular ayrı,
 * terapi görüşmeleri ayrı, raporlar ayrı. "Bu çocukla ne zaman, ne oldu"
 * sorusunun cevabı hiçbirinde yok; kullanıcı kartlar arasında gidip gelip
 * tarihleri kafasında birleştiriyordu. Bu modül hepsini tek bir sıraya dizer.
 *
 * ÇİZELGE KAYNAK DEĞİL, GÖRÜNÜM: hiçbir olayı kendisi üretmiyor, var olan
 * kayıtları okuyup ortak bir biçime çeviriyor. Yeni bir kaynak eklemek
 * `OLAY_SIRASI`'na bir satır ve okuma tarafına bir sorgu demek.
 */

/** Çizelgedeki bir olayın türü. */
export type OlayTuru =
  | "aday"
  | "adayAsama"
  | "adayDonusum"
  | "ogrenciKaydi"
  | "randevuVerildi"
  | "kayit"
  | "terapiOnGorusme"
  | "seans"
  | "terapi"
  | "veliGorusmesi"
  | "zekaTesti"
  | "kayitIptal"
  | "rapor"
  | "arsivRapor";

/**
 * GÜN BAZLI olayların kendi aralarındaki sırası.
 *
 * Kaynakların tarih çapası aynı değil: terapi görüşmesi, veli görüşmesi,
 * zekâ testi ve arşiv raporu GÜN bazlı saklanıyor (`@db.Date`, yani gece
 * yarısı); randevu ve aday olayları gerçek saatli. Ham damgayla sıralanınca
 * gün bazlı her kayıt, aynı günün saatli olaylarının önüne geçiyordu —
 * "randevu verildi" satırı kendi seansından sonra görünüyordu.
 *
 * Çözüm: gün içinde önce SAATLİ olaylar gerçek saatleriyle, sonra gün bazlı
 * olanlar. Gece yarısı bir saat değil, "bu gün" demek; o kaydı günün başına
 * koymak bilmediğimiz bir şeyi iddia etmek olurdu. Bu tablo yalnız iki gün
 * bazlı olay aynı güne düştüğünde devreye giriyor.
 *
 * İlk denemede gün içi sıralama TAMAMEN bu tabloya bırakılmıştı; yerelde
 * bakınca aynı günün saatleri 09:20'den 09:15'e geri sayıyordu.
 */
const OLAY_SIRASI: Record<OlayTuru, number> = {
  aday: 10,
  adayAsama: 11,
  adayDonusum: 12,
  ogrenciKaydi: 13,
  randevuVerildi: 20,
  kayit: 21,
  terapiOnGorusme: 22,
  seans: 30,
  terapi: 31,
  veliGorusmesi: 32,
  zekaTesti: 33,
  kayitIptal: 40,
  rapor: 41,
  arsivRapor: 42,
};

export type ZamanCizelgesiOlayi = {
  /** Liste anahtarı; kaynak tablo + kayıt kimliği birleşimi. */
  id: string;
  tur: OlayTuru;
  /** Sıralama ve gösterim çapası. */
  an: Date;
  /**
   * Kaynak yalnız GÜNÜ biliyor mu (`@db.Date`). Doğruysa arayüz saat
   * yazmaz — gece yarısı gerçek bir saat değil, saklama artığı.
   */
  gunBazli: boolean;
  baslik: string;
  ayrinti: string | null;
  /** Kısa durum etiketi (seansta "Gerçekleşti" gibi); yoksa rozet çizilmez. */
  rozet: string | null;
  /**
   * "İlk" rozetinin gruplama anahtarı — seansta hizmetin adı.
   *
   * `ayrinti`den AYRI: `ayrinti` ekranda okunan serbest metin ve içine uzman
   * adı, şube gibi şeyler girebiliyor; gruplama ise kararlı bir anahtar
   * istiyor. İkisini tek alanda taşımak, ayrıntı metni her değiştiğinde
   * "ilk" hesabını sessizce bozardı.
   */
  grupAnahtari: string | null;
  /**
   * Öğrencinin kendi şubesinden BAŞKA bir şubede geçtiyse o şubenin adı.
   * Aynı şubede null: her satıra "Ümraniye" yazmak gürültü olurdu.
   */
  baskaSube: string | null;
  /** Bu hizmetin GERÇEKLEŞEN ilk seansı mı — `zamanCizelgesiniKur` basar. */
  ilkMi: boolean;
};

/**
 * Okuma katmanının ürettiği ham olay: `ilkMi` yerine ADAYLIK taşır.
 *
 * Ayrım bilinçli: "bu seans gerçekleşti, dolayısıyla ilk olabilir" bilgisini
 * sorgu tarafı biliyor (durum enum'u orada); "bu hizmetin ilki" kararını ise
 * yalnız sıralanmış çizelgeye bakan taraf verebilir. Tek bir alanı iki
 * anlamda kullanmak, sonradan okuyanı yanıltırdı.
 */
export type HamOlay = Omit<ZamanCizelgesiOlayi, "ilkMi"> & {
  /** Seans gerçekleşti mi — yalnız gerçekleşenler "ilk" olabilir. */
  ilkAdayiMi: boolean;
};

/** Olayın düştüğü günün anahtarı — sıralamanın birincil ölçütü. */
function gunAnahtari(an: Date): number {
  return Date.UTC(an.getUTCFullYear(), an.getUTCMonth(), an.getUTCDate());
}

/**
 * Çizelgeyi kurar: sıralar ve "ilk seans" rozetlerini basar.
 *
 * SIRA ESKİDEN YENİYE (kurum kararı): kart ilk temastan bugüne doğru okunur,
 * çocuğun hikâyesi baştan takip edilir.
 */
export function zamanCizelgesiniKur(
  olaylar: readonly HamOlay[],
): ZamanCizelgesiOlayi[] {
  return ilkSeanslariIsaretle(
    [...olaylar].sort((a, b) => {
      const gun = gunAnahtari(a.an) - gunAnahtari(b.an);
      if (gun !== 0) return gun;

      // Saatli olaylar gün bazlı olanlardan önce.
      if (a.gunBazli !== b.gunBazli) return a.gunBazli ? 1 : -1;

      if (a.gunBazli) {
        const tur = OLAY_SIRASI[a.tur] - OLAY_SIRASI[b.tur];
        if (tur !== 0) return tur;
      } else {
        const damga = a.an.getTime() - b.an.getTime();
        if (damga !== 0) return damga;
      }

      return a.id.localeCompare(b.id);
    }),
  );
}

/**
 * Her hizmetin GERÇEKLEŞEN ilk seansına rozet basar.
 *
 * Kurumun istediği ayrım buydu: "ilk oyun terapisi" ile sonraki haftaların
 * seansları çizelgede farklı okunmalı. Ölçüt `grupAnahtari` (hizmet adı) —
 * hizmet başına ayrı sayılıyor, yoksa çocuğun ikinci hizmetinin başlangıcı
 * hiç işaretlenmezdi.
 *
 * GELMEDİĞİ ya da İPTAL olan seans sayılmaz; "ilk" yaşanmış olanı anlatır.
 */
function ilkSeanslariIsaretle(sirali: HamOlay[]): ZamanCizelgesiOlayi[] {
  const gorulen = new Set<string>();
  return sirali.map(({ ilkAdayiMi, ...olay }) => {
    const anahtar = olay.grupAnahtari;
    const aday = olay.tur === "seans" && ilkAdayiMi && anahtar !== null;
    if (!aday || gorulen.has(anahtar)) return { ...olay, ilkMi: false };
    gorulen.add(anahtar);
    return { ...olay, ilkMi: true };
  });
}
