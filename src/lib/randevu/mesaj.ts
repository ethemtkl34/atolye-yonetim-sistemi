import { saatMetni, tarihGunleBicimle } from "@/lib/tarih";
import { waBaglantisi } from "@/lib/telefon";

/**
 * §17.6 — Hatırlatma ve anket mesajları.
 *
 * OTOMATİK GÖNDERİM YOK. Mesaj metni burada hazırlanıyor, WhatsApp
 * bağlantısıyla açılıyor ve gönder tuşuna KULLANICI basıyor. Gerekçe:
 * SMS/WhatsApp servisi abonelik, API kurulumu, gönderim kaydı ve KVKK
 * aydınlatması demek; `wa.me` deseni bugün çalışıyor ve aday modülünde zaten
 * kullanılıyor (`components/iletisim-eylemleri.tsx`).
 *
 * SAF: tarih ve metin üretiyor, ağa çıkmıyor. Metin testlenebilir olmalı —
 * veliye gidecek bir cümlenin yanlış saati göstermesi bu modülün
 * yapabileceği en pahalı hata.
 */

export type MesajBilgisi = {
  kurumAdi: string;
  veliAdi: string;
  /** Seansa giren çocuk; aile danışmanlığında yok. */
  cocukAdi: string | null;
  hizmetAdi: string;
  uzmanAdi: string;
  baslangic: Date;
};

/**
 * Velinin adının ilk kelimesi — "Sayın Ayşe Hanım" yerine "Sayın Ayşe".
 *
 * Tam ad kullanılsaydı "Sayın Ayşe Yılmaz Hanım" gibi bir hitap çıkardı;
 * unvan da eklenmiyor çünkü velinin cinsiyeti kayıtlı değil ve tahmin
 * etmek yanlış hitapla başlayan bir mesaj üretirdi.
 */
function hitap(veliAdi: string): string {
  const ilk = veliAdi.trim().split(/\s+/)[0];
  return ilk || veliAdi.trim();
}

/**
 * Randevu hatırlatması.
 *
 * Belge: "seans hangi gün kaçta olduğuna göre mesaj oluşturulur ve
 * gönderilir." Gün ADIYLA yazılıyor ("18 Ekim 2026, Pazar") — yalnız tarih
 * yazan bir hatırlatma, veliyi takvime bakmaya zorlar.
 */
export function hatirlatmaMetni(bilgi: MesajBilgisi): string {
  const kim = bilgi.cocukAdi ? `${bilgi.cocukAdi} için ` : "";

  return [
    `Sayın ${hitap(bilgi.veliAdi)}, merhaba.`,
    "",
    `${kim}${tarihGunleBicimle(bilgi.baslangic)} günü saat ${saatMetni(
      bilgi.baslangic,
    )}'te ${bilgi.uzmanAdi} ile ${bilgi.hizmetAdi} randevunuz bulunmaktadır.`,
    "",
    "Randevunuza gelemeyecekseniz lütfen bizi önceden bilgilendirin.",
    "",
    bilgi.kurumAdi,
  ].join("\n");
}

/**
 * Kurumun memnuniyet anketinin adresi (28 Eylül 2026'da kurum verdi).
 *
 * Metne GÖMÜLÜ, ortam değişkeni değil: adres bir sır değil ve derleme
 * anında okunmayan bir değişken (bkz. `env.ts` şerhi) burada gereksiz risk
 * olurdu. Kurum adresi değiştirirse bu satır değişir ve `mesaj.test.ts`
 * metnin gerçekten adresle bittiğini doğrular.
 */
export const ANKET_ADRESI = "https://zetzeka.porsline.com/s/Rh4DsMYL";

/**
 * Seans sonrası anket daveti.
 *
 * Belge: "Anket Gönder butonu: seans veya test kaydı üzerinden yöneticinin
 * anketi manuel olarak danışana göndermesini sağlayan bir buton."
 *
 * Anket ADRESİ metnin sonunda. Eskiden hiç eklenmiyordu çünkü kurumun
 * bağlantısı sistemde tanımlı değildi ve uydurma bir adres göndermek hiç
 * göndermemekten kötüydü; kullanıcı bağlantıyı WhatsApp penceresinde elle
 * yapıştırıyordu. Kurum adresi 28 Eylül 2026'da verdi, elle yapıştırma
 * adımı kalktı.
 *
 * Adres kurum adının ÜSTÜNDE: WhatsApp bağlantı önizlemesini son satıra
 * bakarak kuruyor ve imza en sonda kalırsa önizleme çıkmıyor.
 */
export function anketMetni(bilgi: MesajBilgisi): string {
  const kim = bilgi.cocukAdi ? `${bilgi.cocukAdi} için ` : "";

  return [
    `Sayın ${hitap(bilgi.veliAdi)}, merhaba.`,
    "",
    `${kim}${tarihGunleBicimle(bilgi.baslangic)} günü ${bilgi.uzmanAdi} ile ` +
      `gerçekleşen ${bilgi.hizmetAdi} seansımızla ilgili görüşleriniz bizim ` +
      `için değerli.`,
    "",
    "Kısa değerlendirme formumuzu doldurmak ister misiniz?",
    "",
    ANKET_ADRESI,
    "",
    bilgi.kurumAdi,
  ].join("\n");
}

/**
 * Hazır metinle WhatsApp bağlantısı; numara tam değilse `null`.
 *
 * Numara eksikse düğme HİÇ çizilmemeli — çalışmayan düğme, olmayan düğmeden
 * kötüdür (`lib/telefon.ts` kuralı).
 */
export function whatsappMesajBaglantisi(
  telefon: string | null,
  metin: string,
): string | null {
  if (!telefon) return null;
  const temel = waBaglantisi(telefon);
  if (!temel) return null;
  return `${temel}?text=${encodeURIComponent(metin)}`;
}
