import { describe, expect, it } from "vitest";
import {
  UZMAN_RENKLERI,
  blokYazisi,
  siradakiUzmanRengi,
  uzmanRengi,
  uzmanRengiMi,
} from "./uzman-renkleri";

describe("palet", () => {
  it("anahtarlar tekil", () => {
    const anahtarlar = UZMAN_RENKLERI.map((renk) => renk.anahtar);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("her rengin zemini ve metni geçerli hex", () => {
    for (const renk of UZMAN_RENKLERI) {
      expect([renk.anahtar, /^#[0-9a-f]{6}$/.test(renk.zemin)]).toEqual([
        renk.anahtar,
        true,
      ]);
      expect([renk.anahtar, /^#[0-9a-f]{6}$/.test(renk.metin)]).toEqual([
        renk.anahtar,
        true,
      ]);
    }
  });

  it("ton değerleri de tekil", () => {
    // İki uzman aynı rengi göremesin diye anahtarlar tekil; aynı HEX'i
    // taşıyan iki farklı anahtar da pratikte aynı renktir.
    const tonlar = UZMAN_RENKLERI.map((renk) => renk.metin);
    expect(new Set(tonlar).size).toBe(tonlar.length);

    const bloklar = UZMAN_RENKLERI.map((renk) => renk.blok);
    expect(new Set(bloklar).size).toBe(bloklar.length);
  });

  it("her rengin blok tonu geçerli hex", () => {
    for (const renk of UZMAN_RENKLERI) {
      expect([renk.anahtar, /^#[0-9a-f]{6}$/.test(renk.blok)]).toEqual([
        renk.anahtar,
        true,
      ]);
    }
  });

  it("kurumsal palet listenin başında", () => {
    // `siradakiUzmanRengi` listeyi baştan tarıyor: yeni uzman önce marka
    // rengini almalı. Sıra bozulursa kurum paleti fiilen kullanılmaz.
    const ilkSekiz = UZMAN_RENKLERI.slice(0, 8).map((renk) => renk.blok);
    expect(ilkSekiz).toEqual([
      "#e94d1a",
      "#d70b52",
      "#f29100",
      "#94b422",
      "#6bc4ca",
      "#a3185b",
      "#000000",
      "#009bb4",
    ]);
  });
});

describe("blokYazisi", () => {
  it("koyu blokta beyaz, açık blokta koyu yazı verir", () => {
    expect(blokYazisi("#000000")).toBe("#ffffff");
    expect(blokYazisi("#1e40af")).toBe("#ffffff");
    // Kurumsal sarı/yeşil/turkuaz üstünde beyaz yazı okunmuyordu.
    expect(blokYazisi("#f29100")).toBe("#18181b");
    expect(blokYazisi("#94b422")).toBe("#18181b");
    expect(blokYazisi("#6bc4ca")).toBe("#18181b");
  });

  it("paletteki her blok yazısı en az 4.5:1 kontrast tutar", () => {
    // Takvim bloğundaki yazı 0.6–0.7rem: küçük metin eşiği 4.5:1.
    for (const renk of UZMAN_RENKLERI) {
      const oran = kontrastOrani(renk.blok, blokYazisi(renk.blok));
      expect([renk.anahtar, oran >= 4.5]).toEqual([renk.anahtar, true]);
    }
  });
});

/** WCAG 2.1 kontrast oranı — testin kendi bağımsız hesabı. */
function kontrastOrani(a: string, b: string): number {
  const parlak = (hex: string) => {
    const kanal = (sekizBit: number) => {
      const oran = sekizBit / 255;
      return oran <= 0.03928 ? oran / 12.92 : ((oran + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * kanal(Number.parseInt(hex.slice(1, 3), 16)) +
      0.7152 * kanal(Number.parseInt(hex.slice(3, 5), 16)) +
      0.0722 * kanal(Number.parseInt(hex.slice(5, 7), 16))
    );
  };
  const [yuksek, dusuk] = [parlak(a), parlak(b)].sort((x, y) => y - x);
  return (yuksek + 0.05) / (dusuk + 0.05);
}

describe("uzmanRengiMi", () => {
  it("palet içindeki anahtarı tanır", () => {
    expect(uzmanRengiMi("mavi")).toBe(true);
    expect(uzmanRengiMi("mor")).toBe(true);
  });

  it("palet dışını reddeder", () => {
    expect(uzmanRengiMi("#ff0000")).toBe(false);
    expect(uzmanRengiMi("")).toBe(false);
    expect(uzmanRengiMi(null)).toBe(false);
    expect(uzmanRengiMi(undefined)).toBe(false);
    // Prototip zinciri üzerinden gelen adlar da geçmemeli.
    expect(uzmanRengiMi("toString")).toBe(false);
    expect(uzmanRengiMi("constructor")).toBe(false);
  });
});

describe("uzmanRengi", () => {
  it("anahtarın tonunu döner", () => {
    expect(uzmanRengi("mor").etiket).toBe("Mor");
  });

  it("bilinmeyen anahtarda ilk renge düşer", () => {
    // Palet küçültülürse eski kayıtlar bilinmeyen anahtar taşır; bir uzmanın
    // rengi yüzünden takvimin hiç çizilmemesi kabul edilemez.
    expect(uzmanRengi("yok-boyle-bir-renk")).toEqual(UZMAN_RENKLERI[0]);
    expect(uzmanRengi("")).toEqual(UZMAN_RENKLERI[0]);
  });
});

describe("siradakiUzmanRengi", () => {
  it("kimse yokken ilk rengi verir", () => {
    expect(siradakiUzmanRengi([])).toBe(UZMAN_RENKLERI[0].anahtar);
  });

  it("kullanılmayan ilk rengi seçer", () => {
    expect(siradakiUzmanRengi([UZMAN_RENKLERI[0].anahtar])).toBe(
      UZMAN_RENKLERI[1].anahtar,
    );
  });

  it("aradaki boşluğu doldurur", () => {
    const kullanilan = UZMAN_RENKLERI.filter((_, i) => i !== 3).map(
      (renk) => renk.anahtar,
    );
    expect(siradakiUzmanRengi(kullanilan)).toBe(UZMAN_RENKLERI[3].anahtar);
  });

  it("palet dolduğunda başa döner, hata vermez", () => {
    // On ikiden fazla uzmanda renk tekrarı kaçınılmaz; iki uzmanın aynı
    // rengi paylaşması hiç renk olmamasından iyi.
    const hepsi = UZMAN_RENKLERI.map((renk) => renk.anahtar);
    expect(uzmanRengiMi(siradakiUzmanRengi(hepsi))).toBe(true);
    expect(uzmanRengiMi(siradakiUzmanRengi([...hepsi, ...hepsi]))).toBe(true);
  });
});
