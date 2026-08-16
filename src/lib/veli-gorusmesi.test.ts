import { describe, expect, it } from "vitest";
import {
  GOZLEM_ALANLARI,
  atolyeOzetiMetniUret,
  gorusmeCercevesiUret,
  gozlemYorumuUret,
  veliBriefiCozumle,
  veliBriefiUret,
  veliFormuCozumle,
  yasBandiSec,
  type GozlemCevabi,
  type VeliGorusmeSecimleri,
} from "./veli-gorusmesi";
import { raporAnaliziUret, type RaporGirdisi } from "./rapor-motoru";
import type { PuanlamaGirdisi } from "./puan-hesaplari";

const SORULAR = [
  "Atölye ve etkinliklere ilgi gösterir.",
  "İnce motor becerilerini etkin şekilde kullanır.",
  "Zamanı doğru ve etkin kullanır.",
];

function katildi(...degerler: (number | null)[]): PuanlamaGirdisi {
  return {
    attended: true,
    answers: degerler.map((value, i) => ({
      questionId: `soru-${i + 1}`,
      questionTextSnapshot: SORULAR[i],
      value,
      sortOrder: i,
    })),
  };
}

function girdi(atolyeler: RaporGirdisi["atolyeler"]): RaporGirdisi {
  return {
    ogrenciAdi: "Tuana Yılmaz",
    ogrenciIlkAdi: "Tuana",
    kapsam: [
      { programAdi: "2026 Sonbahar Dönemi", grupAdi: "1. Grup", tur: "Dönem" },
    ],
    atolyeler,
  };
}

function cevap(deger: number, sira = 0): GozlemCevabi {
  return {
    anahtar: GOZLEM_ALANLARI[sira].anahtar,
    soruMetni: GOZLEM_ALANLARI[sira].metin,
    baslik: GOZLEM_ALANLARI[sira].baslik,
    deger,
  };
}

const BOS_SECIMLER: VeliGorusmeSecimleri = {
  band: "8-10",
  genelAnahtarlari: [],
  gucluAnahtarlari: [],
  zorlanmaAnahtarlari: [],
  yonlendirmeler: [],
};

describe("yasBandiSec", () => {
  it("yaşı doğru banda yerleştirir", () => {
    expect(yasBandiSec(4).band).toBe("4-5");
    expect(yasBandiSec(5).band).toBe("4-5");
    expect(yasBandiSec(6).band).toBe("6-7");
    expect(yasBandiSec(7).band).toBe("6-7");
    expect(yasBandiSec(8).band).toBe("8-10");
    expect(yasBandiSec(10).band).toBe("8-10");
  });

  it("aralık içindeki yaşları bant dışı saymaz", () => {
    expect(yasBandiSec(4).bandDisi).toBe(false);
    expect(yasBandiSec(10).bandDisi).toBe(false);
  });

  it("aralık dışını en yakın banda kıstırır ve işaretler", () => {
    // Kurumda 11 yaşında öğrenci var; form 4–10 için yazıldı.
    expect(yasBandiSec(11)).toEqual({ band: "8-10", bandDisi: true });
    expect(yasBandiSec(14)).toEqual({ band: "8-10", bandDisi: true });
    // Doğum tarihi hatalı girilmiş kayıtlar aşağı uçtan taşabiliyor.
    expect(yasBandiSec(3)).toEqual({ band: "4-5", bandDisi: true });
    expect(yasBandiSec(0)).toEqual({ band: "4-5", bandDisi: true });
  });
});

describe("gozlemYorumuUret", () => {
  it("değer bantlarına göre farklı yorum üretir", () => {
    // Aynı alan, üç farklı bant — üç farklı dil.
    const [yuksek] = gozlemYorumuUret("Tuana", [cevap(5)]);
    const [orta] = gozlemYorumuUret("Tuana", [cevap(3)]);
    const [dusuk] = gozlemYorumuUret("Tuana", [cevap(1)]);

    expect(yuksek).toContain("güçlü");
    expect(orta).toContain("dengeli");
    expect(dusuk).toContain("destek");
    expect(new Set([yuksek, orta, dusuk]).size).toBe(3);
  });

  it("adı yalın hâlde kullanır — yüklem çocuğa ait", () => {
    // "Tuana’nın … sergilemektedir" bozuk bir cümleydi; özne çocuğun kendisi.
    const [yorum] = gozlemYorumuUret("Tuana", [cevap(4)]);
    expect(yorum).toContain("Tuana ");
    expect(yorum).not.toContain("Tuana’nın");
  });

  it("kısa alan adını cevabın kendi kopyasından okur, sabit listeden değil", () => {
    // Snapshot ilkesi: alanlar sonradan değişse de kayıt o günkü adı taşır.
    const eskiBaslik = "Grup içinde yardımlaşma";
    const [yorum] = gozlemYorumuUret("Tuana", [
      {
        anahtar: "grup-calismasi",
        soruMetni: "Grup içinde arkadaşlarına yardımcı olur.",
        baslik: eskiBaslik,
        deger: 5,
      },
    ]);
    expect(yorum).toContain("grup içinde yardımlaşma");
    expect(yorum).not.toContain(GOZLEM_ALANLARI[6].baslik.toLowerCase());
  });

  it("başlığı olmayan ESKİ kayıtta soru metnine düşer", () => {
    // 2026 Ağustos öncesi üç soruluk mini test kayıtlarında `baslik` yok;
    // detay penceresi o kayıtları da açabilmeli.
    const [yorum] = gozlemYorumuUret("Tuana", [
      {
        anahtar: "sosyallik",
        soruMetni: "Akranlarıyla kolay iletişim kurar ve gruba uyum sağlar.",
        deger: 5,
      },
    ]);
    expect(yorum).toContain("akranlarıyla kolay iletişim kurar");
  });

  it("cevap sırasını korur ve deterministiktir", () => {
    const cevaplar = [cevap(5, 0), cevap(1, 1), cevap(3, 2)];
    const birinci = gozlemYorumuUret("Tuana", cevaplar);
    const ikinci = gozlemYorumuUret("Tuana", cevaplar);

    expect(birinci).toHaveLength(3);
    expect(birinci).toEqual(ikinci);
    expect(birinci[1]).toContain("dikkatini sürdürme");
  });
});

describe("gorusmeCercevesiUret", () => {
  it("hiçbir şey işaretlenmemişse boş döner — kapanış cümlesi de yazılmaz", () => {
    expect(gorusmeCercevesiUret(BOS_SECIMLER)).toEqual([]);
  });

  it("işaretlenen her bölüm için etiketli bir parça üretir", () => {
    const cerceve = gorusmeCercevesiUret({
      ...BOS_SECIMLER,
      genelAnahtarlari: ["merakli"],
      gucluAnahtarlari: ["planlama"],
      zorlanmaAnahtarlari: ["kaygi"],
      yonlendirmeler: [
        { tur: "ERGOTERAPI", etiket: "Ergoterapi", not: "duyusal profil" },
      ],
    });

    const etiketler = cerceve.map((b) => b.etiket);
    expect(etiketler).toHaveLength(5);
    expect(etiketler[0]).toContain("GENEL PROFİL");
    expect(etiketler[4]).toContain("KAPANIŞ");
    expect(cerceve[0].metin).toContain("Meraklı");
    expect(cerceve[3].metin).toContain("Ergoterapi (duyusal profil)");
  });

  it("sözlükte karşılığı olmayan anahtarı sessizce atlar", () => {
    // Bant değişince banda özel madde ("ayrilmakaygisi" yalnızca 4-5'te)
    // işaretli kalmış olabilir; başlıksız satır üretmek yerine düşmeli.
    const cerceve = gorusmeCercevesiUret({
      ...BOS_SECIMLER,
      band: "8-10",
      zorlanmaAnahtarlari: ["ayrilmakaygisi"],
    });
    expect(cerceve).toEqual([]);
  });

  it("banda göre farklı metin verir", () => {
    const kucuk = gorusmeCercevesiUret({
      ...BOS_SECIMLER,
      band: "4-5",
      gucluAnahtarlari: ["planlama"],
    });
    const buyuk = gorusmeCercevesiUret({
      ...BOS_SECIMLER,
      band: "8-10",
      gucluAnahtarlari: ["planlama"],
    });
    expect(kucuk[0].metin).not.toEqual(buyuk[0].metin);
  });
});

describe("atolyeOzetiMetniUret", () => {
  it("veri yokken tek 'veri yok' cümlesi döner", () => {
    const analiz = raporAnaliziUret(girdi([]));
    const ozet = atolyeOzetiMetniUret(analiz);

    expect(ozet).toEqual([
      "Bu tarihe kadar değerlendirilmiş atölye oturumu bulunmamaktadır.",
    ]);
  });

  it("oturum sayısı, güçlü ve desteklenecek alanlarla kısa özet üretir", () => {
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 5, 2), katildi(5, 4, 2), katildi(5, 5, 2)],
        },
      ]),
    );
    const ozet = atolyeOzetiMetniUret(analiz);

    expect(ozet[0]).toContain("1 atölyedeki 3 oturumu");
    expect(ozet.join(" ")).toContain("Güçlü görünen alanlar:");
    expect(ozet.join(" ")).toContain("Desteklenebilecek alan:");
    // "Çok kısa rapor" sözleşmesi: özet birkaç cümleyi geçmez.
    expect(ozet.length).toBeLessThanOrEqual(4);
  });

  it("az katılımda ihtiyat cümlesi ekler", () => {
    const analiz = raporAnaliziUret(
      girdi([
        { atolyeAdi: "Bilim Atölyesi", puanlamalar: [katildi(4, 4, 4)] },
      ]),
    );
    const ozet = atolyeOzetiMetniUret(analiz);

    expect(ozet.join(" ")).toContain("ön izlenim");
  });
});

describe("veliBriefiUret", () => {
  it("üç bölümü ayrı ayrı üretir ve analizi saklar", () => {
    const brief = veliBriefiUret({
      ogrenciIlkAdi: "Tuana",
      cevaplar: [cevap(5, 0), cevap(2, 1)],
      secimler: { ...BOS_SECIMLER, genelAnahtarlari: ["merakli"] },
      raporGirdisi: girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(4, 4, 4), katildi(4, 4, 4)],
        },
      ]),
    });

    expect(brief.gozlemParagraflari).toHaveLength(2);
    expect(brief.atolyeParagraflari.length).toBeGreaterThan(0);
    expect(brief.cerceve.length).toBeGreaterThan(0);
    expect(brief.analiz).not.toBeNull();
    expect(brief.metinKaynagi).toBe("sablon");
  });

  it("girdi null ise atölye bölümü 'veri yok' cümlesidir, analiz saklanmaz", () => {
    const brief = veliBriefiUret({
      ogrenciIlkAdi: "Tuana",
      cevaplar: [cevap(3)],
      secimler: BOS_SECIMLER,
      raporGirdisi: null,
    });

    expect(brief.analiz).toBeNull();
    expect(brief.atolyeParagraflari).toEqual([
      "Bu tarihe kadar değerlendirilmiş atölye oturumu bulunmamaktadır.",
    ]);
  });

  it("aynı girdiden her zaman aynı brief çıkar", () => {
    const veri = {
      ogrenciIlkAdi: "Tuana",
      cevaplar: [cevap(5, 0), cevap(3, 1), cevap(1, 2)],
      secimler: {
        ...BOS_SECIMLER,
        genelAnahtarlari: ["merakli", "azimli"],
        zorlanmaAnahtarlari: ["kaygi"],
      },
      raporGirdisi: girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 3, 2), katildi(5, 3, 2)],
        },
      ]),
    };

    expect(veliBriefiUret(veri)).toEqual(veliBriefiUret(veri));
  });
});

describe("veliBriefiCozumle", () => {
  it("ESKİ kaydın `miniTestParagraflari` alanını gözlem paragrafına taşır", () => {
    // 2026 Ağustos öncesi 7 kayıt bu biçimde; normalize edilmezse detay
    // penceresi boş açılırdı.
    const cozulen = veliBriefiCozumle({
      miniTestParagraflari: ["Eski yorum."],
      atolyeParagraflari: ["Eski özet."],
      analiz: null,
      metinKaynagi: "sablon",
    });

    expect(cozulen.gozlemParagraflari).toEqual(["Eski yorum."]);
    expect(cozulen.atolyeParagraflari).toEqual(["Eski özet."]);
    expect(cozulen.cerceve).toEqual([]);
  });

  it("yeni kaydı olduğu gibi okur", () => {
    const cozulen = veliBriefiCozumle({
      gozlemParagraflari: ["Yeni yorum."],
      atolyeParagraflari: [],
      cerceve: [{ etiket: "KAPANIŞ ÖNERİSİ", metin: "…" }],
      analiz: null,
      metinKaynagi: "sablon",
    });

    expect(cozulen.gozlemParagraflari).toEqual(["Yeni yorum."]);
    expect(cozulen.cerceve).toHaveLength(1);
  });

  it("tanınmayan gövdede ekranı düşürmez", () => {
    const cozulen = veliBriefiCozumle(null);
    expect(cozulen.gozlemParagraflari).toEqual([]);
    expect(cozulen.cerceve).toEqual([]);
  });
});

describe("veliFormuCozumle", () => {
  it("form olmayan (eski) kayıtta null döner", () => {
    expect(veliFormuCozumle(null)).toBeNull();
    expect(veliFormuCozumle({})).toBeNull();
  });

  it("işaretleri ve serbest metinleri çözer, boş metni null yapar", () => {
    const form = veliFormuCozumle({
      yas: 9,
      band: "8-10",
      bandDisi: false,
      genel: [{ anahtar: "merakli", baslik: "Meraklı" }],
      guclu: [],
      zorlanma: [{ anahtar: "kaygi", baslik: "Kaygı" }],
      gozlemNotu: "   ",
      gucluOzeti: "Özet",
      atolyeNotlari: [{ atolye: "Robotik Kodlama", not: "Dikkatliydi" }],
    });

    expect(form?.yas).toBe(9);
    expect(form?.genel).toHaveLength(1);
    expect(form?.gozlemNotu).toBeNull();
    expect(form?.gucluOzeti).toBe("Özet");
    expect(form?.atolyeNotlari[0].atolye).toBe("Robotik Kodlama");
  });

  it("bozuk satırları sessizce atar", () => {
    const form = veliFormuCozumle({
      yas: 9,
      band: "8-10",
      genel: [{ anahtar: "merakli" }, { anahtar: "azimli", baslik: "Azimli" }],
      atolyeNotlari: "dizi değil",
    });

    expect(form?.genel).toEqual([{ anahtar: "azimli", baslik: "Azimli" }]);
    expect(form?.atolyeNotlari).toEqual([]);
  });
});
