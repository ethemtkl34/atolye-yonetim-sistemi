import { describe, expect, it } from "vitest";
import {
  atolyeOzetiHesapla,
  kontenjanDurumu,
  ortalama,
  ortalamaBicimle,
  puanlamaOrtalamasi,
  raporGuncelMi,
  type CevapGirdisi,
  type PuanlamaGirdisi,
} from "./scoring";

/** Test okunurluğu için kısa yardımcı: puan listesinden cevap satırı üretir. */
function cevaplar(...degerler: (number | null)[]): CevapGirdisi[] {
  return degerler.map((value, i) => ({
    questionId: `soru-${i + 1}`,
    questionTextSnapshot: `${i + 1}. kriter`,
    value,
    sortOrder: i,
  }));
}

function katildi(...degerler: (number | null)[]): PuanlamaGirdisi {
  return { attended: true, answers: cevaplar(...degerler) };
}

const KATILMADI: PuanlamaGirdisi = { attended: false, answers: [] };

describe("ortalama", () => {
  it("Değerlendirilemedi (null) cevapları hesaba katmaz", () => {
    // 4 ve 2'nin ortalaması 3; aradaki null yok sayılmalı, 0 sayılmamalı.
    expect(ortalama([4, null, 2])).toBe(3);
  });

  it("hiç geçerli puan yoksa null döner, 0 dönmez", () => {
    expect(ortalama([null, null])).toBeNull();
    expect(ortalama([])).toBeNull();
  });
});

describe("puanlamaOrtalamasi", () => {
  it("örnek formdaki ortalamayı üretir", () => {
    // docs/examples/sample-scorecard.md — beklenen ortalama 4,3
    const form = katildi(5, 4, 5, 4, 4, 5, 3, 4, 5, 4);
    expect(ortalamaBicimle(puanlamaOrtalamasi(form))).toBe("4,3");
  });

  it("katılmadıysa ortalama hesaplamaz", () => {
    // §10.2 — Katılmadı işaretli oturum hiçbir ortalamaya dahil edilmez.
    expect(puanlamaOrtalamasi(KATILMADI)).toBeNull();
  });

  it("katılmadı işaretli formda yanlışlıkla puan varsa bile yok sayar", () => {
    const bozukVeri: PuanlamaGirdisi = {
      attended: false,
      answers: cevaplar(5, 5, 5),
    };
    expect(puanlamaOrtalamasi(bozukVeri)).toBeNull();
  });
});

describe("atolyeOzetiHesapla", () => {
  it("katılmadığı oturumları sayar ama ortalamaya katmaz", () => {
    const ozet = atolyeOzetiHesapla([katildi(4, 4), KATILMADI, katildi(2, 2)]);

    expect(ozet.katildigiOturumSayisi).toBe(2);
    expect(ozet.katilmadigiOturumSayisi).toBe(1);
    // Katılmadığı oturum 0 gibi sayılsaydı ortalama 2 olurdu.
    expect(ozet.genelOrtalama).toBe(3);
  });

  it("soru bazlı ortalamaları soru sırasına göre üretir", () => {
    const ozet = atolyeOzetiHesapla([katildi(5, 3), katildi(3, 1)]);

    expect(ozet.soruOrtalamalari.map((s) => s.soruMetni)).toEqual([
      "1. kriter",
      "2. kriter",
    ]);
    expect(ozet.soruOrtalamalari[0].ortalama).toBe(4);
    expect(ozet.soruOrtalamalari[1].ortalama).toBe(2);
  });

  it("hiç puan alınmamış soruyu değerlendirilen sayıya katmaz", () => {
    // İkinci soru her iki oturumda da Değerlendirilemedi.
    const ozet = atolyeOzetiHesapla([katildi(4, null), katildi(5, null)]);

    expect(ozet.degerlendirilenSoruSayisi).toBe(1);
    expect(ozet.soruOrtalamalari[1].ortalama).toBeNull();
    expect(ozet.soruOrtalamalari[1].puanlananOturumSayisi).toBe(0);
  });

  it("silinmiş sorunun geçmiş cevaplarını korunan metinle gruplar", () => {
    // §13.14 — Soru silinince questionId null'a düşer; metin snapshot'ı kalır.
    const silinmisSoruyla: PuanlamaGirdisi[] = [
      {
        attended: true,
        answers: [
          {
            questionId: null,
            questionTextSnapshot: "Kaldırılmış kriter",
            value: 4,
            sortOrder: 0,
          },
        ],
      },
      {
        attended: true,
        answers: [
          {
            questionId: null,
            questionTextSnapshot: "Kaldırılmış kriter",
            value: 2,
            sortOrder: 0,
          },
        ],
      },
    ];

    const ozet = atolyeOzetiHesapla(silinmisSoruyla);
    expect(ozet.soruOrtalamalari).toHaveLength(1);
    expect(ozet.soruOrtalamalari[0].soruMetni).toBe("Kaldırılmış kriter");
    expect(ozet.soruOrtalamalari[0].ortalama).toBe(3);
  });

  it("genel ortalamayı tüm puanlar üzerinden alır, soru ortalamalarının ortalaması olarak değil", () => {
    // 1. soru iki kez puanlandı (5, 5), 2. soru bir kez (1).
    // Tüm puanlar: (5+5+1)/3 = 3,67
    // Soru ortalamalarının ortalaması olsaydı: (5 + 1)/2 = 3 çıkardı.
    const ozet = atolyeOzetiHesapla([katildi(5, 1), katildi(5, null)]);
    expect(ozet.genelOrtalama).toBeCloseTo(11 / 3, 5);
  });
});

describe("kontenjanDurumu", () => {
  it("kontenjan dolduğunda dolu olarak işaretler", () => {
    expect(kontenjanDurumu(12, 12).dolu).toBe(true);
    expect(kontenjanDurumu(12, 11).dolu).toBe(false);
    expect(kontenjanDurumu(12, 11).kalan).toBe(1);
  });

  it("kontenjan aşılmışsa kalan sayıyı negatife düşürmez", () => {
    const durum = kontenjanDurumu(10, 13);
    expect(durum.kalan).toBe(0);
    expect(durum.dolu).toBe(true);
    expect(durum.yuzde).toBe(100);
  });
});

describe("raporGuncelMi", () => {
  const uretim = new Date("2026-12-20T10:00:00Z");

  it("puan rapordan sonra değiştiyse rapor güncel değildir", () => {
    // §13.16 — Puanlar değiştiğinde ilgili rapor güncelliğini yitirir.
    const sonrakiPuanDegisikligi = new Date("2026-12-21T09:00:00Z");
    expect(raporGuncelMi(uretim, sonrakiPuanDegisikligi)).toBe(false);
  });

  it("puanlar rapordan önceyse rapor günceldir", () => {
    const oncekiPuanDegisikligi = new Date("2026-12-19T09:00:00Z");
    expect(raporGuncelMi(uretim, oncekiPuanDegisikligi)).toBe(true);
  });

  it("kapsamda hiç puan yoksa rapor güncel sayılır", () => {
    expect(raporGuncelMi(uretim, null)).toBe(true);
  });
});

describe("ortalamaBicimle", () => {
  it("Türkçe ondalık ayırıcı kullanır", () => {
    expect(ortalamaBicimle(4.28)).toBe("4,3");
    expect(ortalamaBicimle(5)).toBe("5,0");
  });

  it("hesaplanamayan ortalamayı 0 olarak göstermez", () => {
    expect(ortalamaBicimle(null)).toBe("—");
  });
});
