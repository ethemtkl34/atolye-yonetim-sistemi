import { describe, expect, it } from "vitest";
import {
  UZMAN_RENKLERI,
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
  });
});

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
