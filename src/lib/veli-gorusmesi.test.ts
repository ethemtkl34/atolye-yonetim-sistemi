import { describe, expect, it } from "vitest";
import {
  MINI_TEST_SORULARI,
  atolyeOzetiMetniUret,
  miniTestYorumuUret,
  veliBriefiUret,
  type MiniTestCevabi,
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

function cevap(deger: number, sira = 0): MiniTestCevabi {
  return {
    anahtar: MINI_TEST_SORULARI[sira].anahtar,
    soruMetni: MINI_TEST_SORULARI[sira].metin,
    deger,
  };
}

describe("miniTestYorumuUret", () => {
  it("değer bantlarına göre farklı yorum üretir", () => {
    // Aynı soru, üç farklı bant — üç farklı dil.
    const [yuksek] = miniTestYorumuUret("Tuana", [cevap(5)]);
    const [orta] = miniTestYorumuUret("Tuana", [cevap(3)]);
    const [dusuk] = miniTestYorumuUret("Tuana", [cevap(1)]);

    expect(yuksek).toContain("güçlü");
    expect(orta).toContain("dengeli");
    expect(dusuk).toContain("destek");
    expect(new Set([yuksek, orta, dusuk]).size).toBe(3);
  });

  it("öğrenci adını tamlayan ekiyle metne geçirir", () => {
    const [yorum] = miniTestYorumuUret("Tuana", [cevap(4)]);
    expect(yorum).toContain("Tuana’nın");
  });

  it("soru metnini cevabın kendi kopyasından okur, sabit listeden değil", () => {
    // Snapshot ilkesi: sorular sonradan değişse de kayıt o günkü metni taşır.
    const eskiMetin = "Grup içinde arkadaşlarına yardımcı olur.";
    const [yorum] = miniTestYorumuUret("Tuana", [
      { anahtar: "sosyallik", soruMetni: eskiMetin, deger: 5 },
    ]);
    expect(yorum).toContain("grup içinde arkadaşlarına yardımcı olur");
    expect(yorum).not.toContain(MINI_TEST_SORULARI[0].metin);
  });

  it("cevap sırasını korur ve deterministiktir", () => {
    const cevaplar = [cevap(5, 0), cevap(1, 1), cevap(3, 2)];
    const birinci = miniTestYorumuUret("Tuana", cevaplar);
    const ikinci = miniTestYorumuUret("Tuana", cevaplar);

    expect(birinci).toHaveLength(3);
    expect(birinci).toEqual(ikinci);
    expect(birinci[1]).toContain("kendine güvenir");
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
  it("iki bölümü ayrı ayrı üretir ve analizi saklar", () => {
    const brief = veliBriefiUret({
      ogrenciIlkAdi: "Tuana",
      cevaplar: [cevap(5, 0), cevap(2, 1)],
      raporGirdisi: girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(4, 4, 4), katildi(4, 4, 4)],
        },
      ]),
    });

    expect(brief.miniTestParagraflari).toHaveLength(2);
    expect(brief.atolyeParagraflari.length).toBeGreaterThan(0);
    expect(brief.analiz).not.toBeNull();
    expect(brief.metinKaynagi).toBe("sablon");
  });

  it("girdi null ise atölye bölümü 'veri yok' cümlesidir, analiz saklanmaz", () => {
    const brief = veliBriefiUret({
      ogrenciIlkAdi: "Tuana",
      cevaplar: [cevap(3)],
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
