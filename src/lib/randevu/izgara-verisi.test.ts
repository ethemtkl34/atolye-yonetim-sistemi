import { describe, expect, it } from "vitest";
import {
  VARSAYILAN_EKSEN,
  dakikadanOran,
  izgaraEkseni,
  izgaraSutunlariniOlustur,
  mesaiDisiBloklari,
  orandanDakika,
} from "./izgara-verisi";

const gun = (metin: string) => new Date(`${metin}T00:00:00.000Z`);
const an = (metin: string) => new Date(`${metin}:00.000Z`);

// 9 Eylül 2026 çarşamba.
const CARSAMBA = gun("2026-09-09");

describe("izgaraSutunlariniOlustur", () => {
  it("mesaisi olmayan uzmanı gizlemez, mesaiYok işaretler", () => {
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [],
      izinler: [],
      randevular: [],
    });

    expect(sutunlar).toHaveLength(1);
    expect(sutunlar[0]).toMatchObject({
      uzmanId: "u1",
      mesaiYok: true,
      calismaBloklari: [],
    });
  });

  it("yalnız o günün mesaisini alır, başka günü almaz", () => {
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [
        { uzmanId: "u1", gun: "CARSAMBA", baslangicDk: 540, bitisDk: 1080 },
        { uzmanId: "u1", gun: "PERSEMBE", baslangicDk: 600, bitisDk: 900 },
      ],
      izinler: [],
      randevular: [],
    });

    expect(sutunlar[0].mesaiYok).toBe(false);
    expect(sutunlar[0].calismaBloklari).toEqual([
      { baslangicDk: 540, bitisDk: 1080 },
    ]);
  });

  it("mesai sınırını aşan randevuyu kırpmadan yerleştirir", () => {
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [
        { uzmanId: "u1", gun: "CARSAMBA", baslangicDk: 540, bitisDk: 1020 },
      ],
      izinler: [],
      randevular: [
        {
          uzmanId: "u1",
          baslangic: an("2026-09-09T16:30"),
          bitis: an("2026-09-09T17:30"),
        },
      ],
    });

    // Mesai 09:00–17:00 (540–1020); randevu 16:30–17:30 (990–1050) sınırı aşıyor.
    expect(sutunlar[0].randevular).toEqual([
      { baslangicDk: 990, bitisDk: 1050, randevu: sutunlar[0].randevular[0].randevu },
    ]);
  });

  it("izin ve randevu çakışsa bile ikisini de döner", () => {
    const randevu = {
      uzmanId: "u1",
      baslangic: an("2026-09-09T10:00"),
      bitis: an("2026-09-09T11:00"),
    };
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [],
      izinler: [
        { uzmanId: "u1", baslangic: an("2026-09-09T09:00"), bitis: an("2026-09-09T12:00") },
      ],
      randevular: [randevu],
    });

    expect(sutunlar[0].izinBloklari).toEqual([{ baslangicDk: 540, bitisDk: 720 }]);
    expect(sutunlar[0].randevular).toHaveLength(1);
  });

  it("çok günlü izni güne kırpar", () => {
    // İzin çarşamba 20:00'dan perşembe 08:00'a kadar sürüyor.
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [],
      izinler: [
        { uzmanId: "u1", baslangic: an("2026-09-09T20:00"), bitis: an("2026-09-10T08:00") },
      ],
      randevular: [],
    });

    // Çarşamba içindeki pay yalnız 20:00 (1200) – gece yarısı (1440).
    expect(sutunlar[0].izinBloklari).toEqual([{ baslangicDk: 1200, bitisDk: 1440 }]);
  });

  it("randevuyu doğru uzman sütununa yerleştirir", () => {
    const r1 = { uzmanId: "u1", baslangic: an("2026-09-09T10:00"), bitis: an("2026-09-09T11:00") };
    const r2 = { uzmanId: "u2", baslangic: an("2026-09-09T14:00"), bitis: an("2026-09-09T15:00") };
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }, { id: "u2" }],
      mesailer: [],
      izinler: [],
      randevular: [r1, r2],
    });

    expect(sutunlar.find((s) => s.uzmanId === "u1")?.randevular).toEqual([
      { baslangicDk: 600, bitisDk: 660, randevu: r1 },
    ]);
    expect(sutunlar.find((s) => s.uzmanId === "u2")?.randevular).toEqual([
      { baslangicDk: 840, bitisDk: 900, randevu: r2 },
    ]);
  });
});

describe("izgaraEkseni", () => {
  it("kimse çalışmıyorsa varsayılana düşer", () => {
    expect(izgaraEkseni([])).toEqual(VARSAYILAN_EKSEN);

    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [],
      izinler: [],
      randevular: [],
    });
    expect(izgaraEkseni(sutunlar)).toEqual(VARSAYILAN_EKSEN);
  });

  it("karışık mesaide en erken başlangıçtan en geç bitişe genişler", () => {
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }, { id: "u2" }],
      mesailer: [
        { uzmanId: "u1", gun: "CARSAMBA", baslangicDk: 480, bitisDk: 720 }, // 08:00-12:00
        { uzmanId: "u2", gun: "CARSAMBA", baslangicDk: 840, bitisDk: 1200 }, // 14:00-20:00
      ],
      izinler: [],
      randevular: [],
    });

    expect(izgaraEkseni(sutunlar)).toEqual({
      baslangicDk: 480,
      bitisDk: 1200,
      adimDk: 30,
    });
  });

  it("30 dakikaya tam bölünmeyen mesaiyi dışa yuvarlar", () => {
    const sutunlar = izgaraSutunlariniOlustur({
      gun: CARSAMBA,
      uzmanlar: [{ id: "u1" }],
      mesailer: [
        { uzmanId: "u1", gun: "CARSAMBA", baslangicDk: 550, bitisDk: 1010 }, // 09:10-16:50
      ],
      izinler: [],
      randevular: [],
    });

    // 550 -> 540 (aşağı), 1010 -> 1020 (yukarı).
    expect(izgaraEkseni(sutunlar)).toEqual({
      baslangicDk: 540,
      bitisDk: 1020,
      adimDk: 30,
    });
  });
});

describe("mesaiDisiBloklari", () => {
  const eksen = { baslangicDk: 540, bitisDk: 1080, adimDk: 30 }; // 09:00-18:00

  it("mesai yoksa eksenin tamamı boş döner", () => {
    expect(mesaiDisiBloklari([], eksen)).toEqual([
      { baslangicDk: 540, bitisDk: 1080 },
    ]);
  });

  it("tam gün mesaide boşluk yok", () => {
    expect(mesaiDisiBloklari([{ baslangicDk: 540, bitisDk: 1080 }], eksen)).toEqual([]);
  });

  it("öğle arası gibi iki mesai bloğu arasındaki boşluğu bulur", () => {
    const calisma = [
      { baslangicDk: 540, bitisDk: 720 }, // 09:00-12:00
      { baslangicDk: 780, bitisDk: 1080 }, // 13:00-18:00
    ];
    expect(mesaiDisiBloklari(calisma, eksen)).toEqual([
      { baslangicDk: 720, bitisDk: 780 },
    ]);
  });

  it("mesai eksenin dışına taşarsa eksene kırpar", () => {
    // Mesai 08:00 başlıyor ama eksen 09:00'da başlıyor.
    expect(
      mesaiDisiBloklari([{ baslangicDk: 480, bitisDk: 1080 }], eksen),
    ).toEqual([]);
  });
});

describe("dakikadanOran / orandanDakika", () => {
  const eksen = { baslangicDk: 540, bitisDk: 1080, adimDk: 30 };

  it("sınırlarda 0 ve 1 döner", () => {
    expect(dakikadanOran(540, eksen)).toBe(0);
    expect(dakikadanOran(1080, eksen)).toBe(1);
  });

  it("orta noktada 0.5 döner", () => {
    expect(dakikadanOran(810, eksen)).toBe(0.5);
  });

  it("orandanDakika tersini üretir ve adıma yuvarlar", () => {
    expect(orandanDakika(0, eksen)).toBe(540);
    expect(orandanDakika(1, eksen)).toBe(1080);
    // 0.5 -> 810, zaten 30'un katı.
    expect(orandanDakika(0.5, eksen)).toBe(810);
    // Adıma yuvarlama: 550 dakikaya denk gelen oran 540'a yuvarlanmalı.
    const oran550 = (550 - 540) / (1080 - 540);
    expect(orandanDakika(oran550, eksen)).toBe(540);
  });
});
