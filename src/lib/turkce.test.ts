import { describe, expect, it } from "vitest";
import { normalizeArama, normalizeTelefon, turkceKarsilastir } from "./turkce";

describe("normalizeArama", () => {
  it("Türkçe büyük harfleri doğru küçültür", () => {
    // Varsayılan toLowerCase() burada "i̇" (birleşik noktalı i) üretir ve
    // arama eşleşmez; tr-TR yerelinin kullanıldığını doğrular.
    expect(normalizeArama("İPEK")).toBe("ipek");
    expect(normalizeArama("ISPARTA")).toBe("isparta");
  });

  it("aksanlı harfleri sade karşılığına indirger", () => {
    expect(normalizeArama("Şule Çınar")).toBe("sule cinar");
    expect(normalizeArama("Gökçe Öztürk")).toBe("gokce ozturk");
  });

  it("aynı ismin farklı yazımlarını eşitler", () => {
    const yazimlar = ["Şule", "ŞULE", "sule", "SULE", "şule"];
    const sonuclar = new Set(yazimlar.map(normalizeArama));
    expect(sonuclar.size).toBe(1);
  });

  it("fazla boşlukları temizler", () => {
    expect(normalizeArama("  Ayşe   Yılmaz  ")).toBe("ayse yilmaz");
  });
});

describe("normalizeTelefon", () => {
  it("aynı numaranın farklı yazımlarını eşitler", () => {
    const yazimlar = [
      "0532 111 22 33",
      "05321112233",
      "+90 532 111 22 33",
      "532 111 22 33",
      "(0532) 111-22-33",
    ];
    const sonuclar = new Set(yazimlar.map(normalizeTelefon));
    expect(sonuclar.size).toBe(1);
    expect(sonuclar.has("5321112233")).toBe(true);
  });
});

describe("turkceKarsilastir", () => {
  it("Türkçe alfabe sırasına göre sıralar", () => {
    // Türkçe'de sıra: c < ç < ... < g < ğ < h < ı < i < ... < o < ö < ... < s < ş
    const sirali = ["Çınar", "Cengiz", "Şule", "Sule", "İpek", "Irmak"].sort(
      turkceKarsilastir,
    );
    expect(sirali).toEqual([
      "Cengiz",
      "Çınar",
      "Irmak",
      "İpek",
      "Sule",
      "Şule",
    ]);
  });
});
