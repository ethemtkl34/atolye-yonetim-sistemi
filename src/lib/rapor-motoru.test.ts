import { describe, expect, it } from "vitest";
import {
  raporAnaliziUret,
  raporUret,
  type RaporGirdisi,
  raporGuncelMi,
} from "./rapor-motoru";
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

describe("başlıklı sorular", () => {
  /** Yeni tip soru: soru cümlesi + kısa başlık + kategori snapshot'ı. */
  function baslikliKatildi(deger: number): PuanlamaGirdisi {
    return {
      attended: true,
      answers: [
        {
          questionId: "soru-b1",
          questionTextSnapshot:
            "Zorlayıcı durumlarda duygularını kontrol etme becerisi gösteriyor mu?",
          titleSnapshot: "Duygu Düzenleme",
          categorySnapshot: "Yetenek Gelişim Alanları",
          value: deger,
          sortOrder: 0,
        },
      ],
    };
  }

  it("düzyazıda soru cümlesi yerine kısa başlığı kullanır", () => {
    const govde = raporUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [baslikliKatildi(5), baslikliKatildi(5)],
        },
      ]),
    );

    const paragraf = govde.metin.atolyeler[0].paragraf;
    expect(paragraf).toContain("duygu düzenleme");
    expect(paragraf).not.toContain("gösteriyor mu");
  });

  it("başlık ve kategoriyi soru ortalamalarına taşır", () => {
    const analiz = raporAnaliziUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [baslikliKatildi(4)],
        },
      ]),
    );

    const soru = analiz.atolyeler[0].soruOrtalamalari[0];
    expect(soru.baslik).toBe("Duygu Düzenleme");
    expect(soru.kategori).toBe("Yetenek Gelişim Alanları");
  });

  it("aynı başlıklı soruları farklı cümlelerle de atölyeler arası birleştirir", () => {
    // Havuz anahtarı başlık: atölyeden atölyeye küçük cümle farkları aynı
    // beceriyi iki ayrı bulguya bölmemeli.
    const digerCumle: PuanlamaGirdisi = {
      attended: true,
      answers: [
        {
          questionId: "soru-b2",
          questionTextSnapshot:
            "Duygularını kontrol etmeyi robotik çalışmalarında da gösteriyor mu?",
          titleSnapshot: "Duygu Düzenleme",
          categorySnapshot: "Yetenek Gelişim Alanları",
          value: 5,
          sortOrder: 0,
        },
      ],
    };

    const analiz = raporAnaliziUret(
      girdi([
        { atolyeAdi: "Bilim Atölyesi", puanlamalar: [baslikliKatildi(5)] },
        { atolyeAdi: "Robotik Atölyesi", puanlamalar: [digerCumle] },
      ]),
    );

    expect(
      analiz.genel.guclu.filter((b) => b.baslik === "Duygu Düzenleme"),
    ).toHaveLength(1);
    expect(analiz.genel.guclu[0].gozlemSayisi).toBe(2);
  });

  it("başlıksız eski cevaplar eski davranışı korur", () => {
    const govde = raporUret(
      girdi([
        {
          atolyeAdi: "Bilim Atölyesi",
          puanlamalar: [katildi(5, 5, 3), katildi(5, 4, 3)],
        },
      ]),
    );

    // Eski tip soru metni düzyazıya aynen (ilk harfi küçültülüp) gömülür.
    expect(govde.metin.atolyeler[0].paragraf).toContain(
      "atölye ve etkinliklere ilgi gösterir",
    );
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
