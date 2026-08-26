import { describe, expect, it } from "vitest";
import { e164Telefon, telBaglantisi, waBaglantisi } from "./telefon";

describe("e164Telefon", () => {
  it("aynı numaranın farklı yazımlarını tek biçime indirger", () => {
    const yazimlar = [
      "0532 111 22 33",
      "05321112233",
      "+90 532 111 22 33",
      "0090 532 111 22 33",
      "532 111 22 33",
    ];
    for (const yazim of yazimlar) {
      expect(e164Telefon(yazim)).toBe("+905321112233");
    }
  });

  it("eksik numaraya bağlantı üretmez", () => {
    // Arama süzgeci kısmi numarayı kabul eder, bağlantı üretimi etmez:
    // yarım numaraya tel: vermek yanlış kişiyi aratır.
    expect(e164Telefon("0532")).toBeNull();
    expect(e164Telefon("532 111")).toBeNull();
  });

  it("fazla haneli numarayı reddeder", () => {
    expect(e164Telefon("0532 111 22 33 44")).toBeNull();
  });

  it("boş ve harfli girdide null döner", () => {
    expect(e164Telefon("")).toBeNull();
    expect(e164Telefon("telefon yok")).toBeNull();
  });
});

describe("bağlantılar", () => {
  it("tel: bağlantısı uluslararası biçim taşır", () => {
    expect(telBaglantisi("0532 111 22 33")).toBe("tel:+905321112233");
  });

  it("wa.me bağlantısı artı işareti taşımaz", () => {
    expect(waBaglantisi("0532 111 22 33")).toBe("https://wa.me/905321112233");
  });

  it("geçersiz numarada iki bağlantı da null döner", () => {
    expect(telBaglantisi("0532")).toBeNull();
    expect(waBaglantisi("0532")).toBeNull();
  });
});
