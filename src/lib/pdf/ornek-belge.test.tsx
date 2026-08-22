import { describe, it } from "vitest";
import { renderToFile } from "@react-pdf/renderer";
import { RaporBelgesiV2 } from "./rapor-belgesi-v2";
import { gelisimDegisimi, KADEMELER } from "@/lib/rapor-bantlari";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";

/**
 * Rapor belgesini gözle denemek için örnek gövde — `npm run rapor:ornek`.
 *
 * Test değil, ARAÇ: iddiası yok, `RAPOR_CIKTISI` verilmedikçe atlanır ve
 * normal test koşusunu yavaşlatmaz. Belgeyi yalnızca kodu okuyarak
 * doğrulamak mümkün olmuyor — bu dosyanın ilk koşusu üç gerçek kusuru
 * ortaya çıkardı: uzun kademe adının dar sütundan taşması, ayrı bir sayfaya
 * düşüp arkasında boş sayfa bırakan not kutusu ve küçük harfle başlayan
 * ilerleme cümlesi.
 *
 * Gövde ELLE yazılıyor ama metinleri üreten fonksiyonlar gerçek olanlar
 * (`gelisimDegisimi` gibi); yoksa sayfada üretimin değil, buranın yazdığı
 * cümleler görünürdü.
 */
const CIKTI = process.env.RAPOR_CIKTISI;

const kisaAd = (ad: string) =>
  ad.replace(/Gelişim Alanları/i, "beceriler").toLocaleLowerCase("tr-TR");

const alan = (
  ad: string,
  orta: number,
  son: number,
  grup: number,
) => ({
  ad,
  bant:
    son - grup >= 0.25
      ? KADEMELER.YUKSEK
      : son - grup <= -0.25
        ? { ...KADEMELER.DUSUK, etiket: "Gelişmekte" }
        : KADEMELER.ORTALAMA,
  kazanimlar: ["Duygu Tanıma ve İfade Etme", "Duygu Düzenleme", "Empati Gelişimi"],
  cumle: `Atölye kapsamında "duygu tanıma ve empati gelişimi" gibi ${kisaAd(ad)} değerlendirildiğinde öğrencinin gelişimi yaşıtlarıyla benzer bir düzeyde ilerlemektedir.`,
  ogrenciOrtalamasi: son,
  grupOrtalamasi: grup,
  ortaOrtalamasi: orta,
  // Cümleyi elle yazmıyoruz: denemenin değeri, ÜRETİMİN yazdığı metni
  // sayfada görmekte.
  degisim: gelisimDegisimi(orta, son, kisaAd(ad)),
});

const atolye = (ad: string, ilgi: number, basari: number) => ({
  atolyeAdi: ad,
  ilgi:
    ilgi >= 4
      ? KADEMELER.YUKSEK
      : ilgi < 3
        ? { ...KADEMELER.DUSUK, etiket: "Gelişmekte" }
        : KADEMELER.ORTALAMA,
  basari:
    basari >= 4
      ? KADEMELER.YUKSEK
      : basari < 3
        ? { ...KADEMELER.DUSUK, etiket: "Gelişmekte" }
        : KADEMELER.ORTALAMA,
  ilgiOrtalamasi: ilgi,
  basariOrtalamasi: basari,
  katildigiOturumSayisi: 8,
  katilmadigiOturumSayisi: 2,
  metin: `Şule, değerlendirme kapsamındaki 10 oturumun 8'ine katılmıştır. Değerlendirmelerde özellikle merak ve keşif isteği ile takım çalışması başlıklarında güçlü bir görünüm sergilemiştir.`,
});

const GOVDE: RaporGovdesiV2 = {
  surum: 2,
  ogrenci: { adSoyad: "Şule Çınar", ilkAd: "Şule", sinif: "3" },
  egitimYili: "2026-2027",
  subeAdi: "Ümraniye Şubesi",
  grupOgrenciSayisi: 12,
  kapsam: [{ programAdi: "2026 Sonbahar Dönemi", grupAdi: "1. Grup", tur: "Dönem" }],
  atolyeIcerikleri: [
    { atolyeAdi: "Bilim Atölyesi", metin: "Dönem boyunca maddenin hâlleri, basit devreler ve gözlem defteri tutma çalışmaları yürütüldü." },
    { atolyeAdi: "Robotik ve Kodlama Atölyesi", metin: "Blok tabanlı kodlama ile çizgi izleyen robot kurulumu ve hata ayıklama alıştırmaları yapıldı." },
  ],
  gelisimAlanlari: [
    alan("Duygusal Gelişim Alanları", 3.4, 4.1, 3.9),
    alan("Sosyal Gelişim Alanları", 4.0, 4.1, 3.8),
    alan("Bilişsel Gelişim Alanları", 4.3, 3.6, 4.0),
  ],
  atolyeKademeleri: [
    atolye("Bilim Atölyesi", 4.4, 4.2),
    atolye("Robotik ve Kodlama Atölyesi", 4.6, 3.4),
    atolye("Astronomi Atölyesi", 3.2, 3.1),
    atolye("Zekâ ve Akıl Oyunları Atölyesi", 4.1, 2.8),
    atolye("Hayal Tasarım Atölyesi", 3.8, 3.9),
  ],
  asimetriler: [
    {
      atolyeAdi: "Robotik ve Kodlama Atölyesi",
      yon: "ILGI_YUKSEK",
      cumle:
        "Robotik ve Kodlama Atölyesi çalışmalarına ilgisi belirgin biçimde yüksek olmakla birlikte, kazanımlara ulaşma düzeyi bu ilgiyle aynı oranda ilerlememiştir; bu alanda beceri desteği sağlanmasının öğrenciyi ilgisinden uzaklaştırmadan ilerletebileceği değerlendirilmektedir.",
    },
  ],
  gozlem: {
    giris: "2026 Sonbahar Dönemi atölye çalışmaları on hafta boyunca beş farklı atölyede yürütülmüştür.",
    profil: "Şule atölye çalışmalarına istekli katılmış, yönergeleri dikkatle dinlemiş ve grup çalışmalarında sorumluluk almıştır.",
    bloklar: [
      { beceriAdi: "Dikkat ve Konsantrasyon", tanim: "Görev süresince odağı sürdürebilme.", etkinlik: "Devre kurma etkinliğinde adımların sırayla izlenmesi amaçlanmıştır.", gozlem: "Şule etkinlik boyunca adımları sırayla izlemiş, hata oluştuğunda başa dönerek kontrol etmiştir." },
      { beceriAdi: "İş Birliği ve Paylaşma", tanim: "Ortak görevde rol alma.", etkinlik: "Takım hâlinde köprü tasarımı çalışması yapılmıştır.", gozlem: "Malzemeleri arkadaşlarıyla paylaşmış, kendi önerisi seçilmediğinde grubun kararına uymuştur." },
    ],
    sonuc: "Şule dönem boyunca istikrarlı bir katılım göstermiş ve grup içinde yapıcı bir rol üstlenmiştir. Kazanımlara ulaşma düzeyi atölyeden atölyeye değişmektedir.",
    oneriler: "Ev ortamında birlikte kısa deneyler yapılması ve günlük tutma alışkanlığının desteklenmesi faydalı olacaktır.",
    urunler: [
      { ad: "Elektronik Deney Seti 100+ Deney 5+ Yaş", url: "https://ornek.tuzder.org/urun/deney-seti" },
      { ad: "Torappu Akıl Oyunu", url: "https://ornek.tuzder.org/urun/torappu" },
    ],
  },
  kademeEtiketleri: {
    YUKSEK: KADEMELER.YUKSEK.etiket,
    ORTALAMA: KADEMELER.ORTALAMA.etiket,
    DUSUK: "Gelişmekte",
  },
  atolyeEsikleri: { yuksek: 4.2, dusuk: 3.1 },
  metinKaynagi: "ai",
};

describe("örnek rapor belgesi", () => {
  it.runIf(CIKTI)("örnek gövdeyi PDF'e basar", async () => {
    await renderToFile(
      RaporBelgesiV2({ govde: GOVDE, uretimZamani: new Date("2026-08-22T09:00:00Z") }),
      CIKTI!,
    );
  }, 60000);
});
