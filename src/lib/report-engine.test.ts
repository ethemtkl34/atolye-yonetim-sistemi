import { describe, expect, it } from "vitest";
import {
  raporAnaliziUret,
  raporUret,
  type RaporGirdisi,
} from "./report-engine";
import type { PuanlamaGirdisi } from "./scoring";

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

const KATILMADI: PuanlamaGirdisi = { attended: false, answers: [] };

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

describe("raporAnaliziUret", () => {
  it("yüksek puanlı soruları güçlü alan olarak işaretler", () => {
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 5, 3), katildi(5, 4, 3)],
        },
      ]),
    );

    const atolye = analiz.atolyeler[0];
    expect(atolye.guclu.map((b) => b.soruMetni)).toEqual([
      SORULAR[0],
      SORULAR[1],
    ]);
    expect(atolye.desteklenecek).toHaveLength(0);
  });

  it("tek gözlemden güçlü veya zayıf yargı üretmez", () => {
    // §11.3 — Tek bir düşük puandan kesin ve ağır yargı çıkarılmamalı.
    const analiz = raporAnaliziUret(
      girdi([{ atolyeAdi: "Bilim Atölyesi", puanlamalar: [katildi(1, 5, 3)] }]),
    );

    expect(analiz.atolyeler[0].desteklenecek).toHaveLength(0);
    expect(analiz.atolyeler[0].guclu).toHaveLength(0);
    expect(analiz.atolyeler[0].ihtiyatli).toBe(true);
  });

  it("düşük puanlı soruyu yeterli gözlem varsa desteklenecek alan sayar", () => {
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(4, 4, 2), katildi(4, 4, 2)],
        },
      ]),
    );

    expect(analiz.atolyeler[0].desteklenecek.map((b) => b.soruMetni)).toEqual([
      SORULAR[2],
    ]);
  });

  it("Değerlendirilemedi cevaplarını olumsuz saymaz", () => {
    // §11.3 — null cevap ortalamaya girmez; olumsuz puan gibi yorumlanamaz.
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, null, null), katildi(5, null, null)],
        },
      ]),
    );

    expect(analiz.atolyeler[0].genelOrtalama).toBe(5);
    expect(analiz.atolyeler[0].desteklenecek).toHaveLength(0);
    expect(analiz.atolyeler[0].degerlendirilenSoruSayisi).toBe(1);
  });

  it("katılmadığı oturumları sayar ama ortalamaya katmaz", () => {
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(4, 4, 4), KATILMADI],
        },
      ]),
    );

    expect(analiz.genel.katildigiOturumSayisi).toBe(1);
    expect(analiz.genel.katilmadigiOturumSayisi).toBe(1);
    expect(analiz.atolyeler[0].genelOrtalama).toBe(4);
  });

  it("hiç puanlama yoksa veri yok olarak işaretler", () => {
    const analiz = raporAnaliziUret(
      girdi([{ atolyeAdi: "Bilim Atölyesi", puanlamalar: [KATILMADI] }]),
    );

    expect(analiz.atolyeler[0].veriVar).toBe(false);
    expect(analiz.genel.veriVar).toBe(false);
    expect(analiz.genel.genelOrtalama).toBeNull();
  });

  it("genel değerlendirmede aynı soruyu atölyeler arası birleştirir", () => {
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 3, 3), katildi(5, 3, 3)],
        },
        {
          atolyeAdi: "Astronomi Atölyesi",
          puanlamalar: [katildi(5, 3, 3), katildi(5, 3, 3)],
        },
      ]),
    );

    expect(analiz.genel.guclu.map((b) => b.soruMetni)).toEqual([SORULAR[0]]);
    expect(analiz.genel.guclu[0].gozlemSayisi).toBe(4);
  });
});

describe("raporUret", () => {
  it("metni öğrencinin adıyla ve doğru ekle kurar", () => {
    const rapor = raporUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 5, 4), katildi(5, 4, 4), katildi(5, 5, 4)],
        },
      ]),
    );

    expect(rapor.metin.atolyeler[0].paragraf).toContain("Tuana’nın");
    expect(rapor.metin.genelParagraflar.join(" ")).toContain("Tuana’nın");
    expect(rapor.metinKaynagi).toBe("sablon");
  });

  it("aynı girdiden her zaman aynı metni üretir", () => {
    const veri = girdi([
      {
        atolyeAdi: "Bilim Atölyesi",
        puanlamalar: [katildi(5, 4, 3), katildi(4, 4, 3)],
      },
    ]);

    expect(raporUret(veri).metin).toEqual(raporUret(veri).metin);
  });

  it("art arda gelen atölyelerde aynı cümle kalıbını tekrarlamaz", () => {
    // §11.3 — Metin tekrarlarından kaçınılmalıdır.
    const rapor = raporUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 5, 5), katildi(5, 5, 5)],
        },
        {
          atolyeAdi: "Astronomi Atölyesi",
          puanlamalar: [katildi(5, 5, 5), katildi(5, 5, 5)],
        },
      ]),
    );

    const [ilk, ikinci] = rapor.metin.atolyeler;
    expect(ilk.paragraf).not.toBe(ikinci.paragraf);
  });

  it("az veri varsa ihtiyatlı dil kullanır", () => {
    const rapor = raporUret(
      girdi([{ atolyeAdi: "Bilim Atölyesi", puanlamalar: [katildi(5, 5, 5)] }]),
    );

    expect(rapor.metin.atolyeler[0].paragraf).toContain("ön gözlem");
    expect(rapor.metin.genelParagraflar.join(" ")).toContain("ön gözlem");
  });

  it("katılmadığı oturumu olumsuz yargı olarak yazmaz", () => {
    const rapor = raporUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(4, 4, 4), katildi(4, 4, 4), KATILMADI],
        },
      ]),
    );

    const paragraf = rapor.metin.atolyeler[0].paragraf;
    expect(paragraf).toContain("ortalamaya dahil edilmemiştir");
    expect(paragraf).not.toMatch(/ilgisiz|başarısız|olumsuz/i);
  });

  it("puanlaması olmayan öğrenci için uydurma yapmaz", () => {
    const rapor = raporUret(
      girdi([{ atolyeAdi: "Bilim Atölyesi", puanlamalar: [] }]),
    );

    expect(rapor.metin.genelParagraflar.join(" ")).toContain(
      "henüz değerlendirilmiş bir atölye oturumu bulunmamaktadır",
    );
    expect(rapor.analiz.genel.guclu).toHaveLength(0);
  });
});
