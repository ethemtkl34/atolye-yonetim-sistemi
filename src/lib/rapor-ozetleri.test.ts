import { describe, expect, it } from "vitest";
import {
  gelisimAlanOrtalamalari,
  type GelisimCevabi,
} from "./gelisim-degerlendirmesi";
import {
  kategoriOrtalamalari,
  type SoruOrtalamasi,
} from "./puan-hesaplari";

function soru(
  kategori: string | null,
  puanToplami: number,
  gozlem: number,
  sortOrder: number,
): SoruOrtalamasi {
  return {
    anahtar: `${kategori}-${sortOrder}`,
    soruMetni: "Soru",
    baslik: "Başlık",
    kategori,
    ortalama: gozlem > 0 ? puanToplami / gozlem : null,
    puanlananOturumSayisi: gozlem,
    puanToplami,
    sortOrder,
  };
}

describe("kategoriOrtalamalari", () => {
  it("soruları konu başlığına göre toplar", () => {
    const sonuc = kategoriOrtalamalari([
      soru("Dersin İlgi ve Merak Alanları", 40, 10, 0),
      soru("Dersin İlgi ve Merak Alanları", 45, 10, 1),
      soru("Dersin Yetenek Gelişim Alanları", 30, 10, 2),
    ]);

    expect(sonuc).toHaveLength(2);
    expect(sonuc[0].kategori).toBe("Dersin İlgi ve Merak Alanları");
    expect(sonuc[0].ortalama).toBeCloseTo(4.25);
    expect(sonuc[0].gozlemSayisi).toBe(20);
    expect(sonuc[1].ortalama).toBeCloseTo(3.0);
  });

  it("ortalamaların ortalamasını değil ağırlıklı ortalamayı alır", () => {
    // Tek gözlemli 5 puan ile dokuz gözlemli 3 puan.
    // Ortalamaların ortalaması 4,0 olurdu; doğrusu 3,2.
    const sonuc = kategoriOrtalamalari([
      soru("Alan", 5, 1, 0),
      soru("Alan", 27, 9, 1),
    ]);
    expect(sonuc[0].ortalama).toBeCloseTo(3.2);
  });

  it("kategorisi olmayan sorular hiçbir kategoriye girmez", () => {
    const sonuc = kategoriOrtalamalari([
      soru(null, 50, 10, 0),
      soru("Alan", 40, 10, 1),
    ]);
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].kategori).toBe("Alan");
  });

  it("kategori sırası formdaki bölüm sırasını korur", () => {
    const sonuc = kategoriOrtalamalari([
      soru("İkinci", 40, 10, 5),
      soru("Birinci", 40, 10, 1),
      soru("İkinci", 40, 10, 6),
    ]);
    expect(sonuc.map((k) => k.kategori)).toEqual(["Birinci", "İkinci"]);
  });

  it("hiç geçerli puan yoksa ortalama hesaplanmaz", () => {
    const sonuc = kategoriOrtalamalari([soru("Alan", 0, 0, 0)]);
    expect(sonuc[0].ortalama).toBeNull();
  });
});

function cevap(kategori: string, deger: number | null): GelisimCevabi {
  return {
    anahtar: `${kategori}-${deger}`,
    kategori,
    baslik: "Başlık",
    soruMetni: "Soru",
    deger,
  };
}

describe("gelisimAlanOrtalamalari", () => {
  it("üç alanı soru listesindeki sırayla döndürür", () => {
    const sonuc = gelisimAlanOrtalamalari([
      cevap("Bilişsel Gelişim Alanları", 4),
      cevap("Duygusal Gelişim Alanları", 5),
      cevap("Sosyal Gelişim Alanları", 3),
    ]);

    expect(sonuc.map((a) => a.kategori)).toEqual([
      "Duygusal Gelişim Alanları",
      "Sosyal Gelişim Alanları",
      "Bilişsel Gelişim Alanları",
    ]);
  });

  it("Değerlendirilemedi cevapları ortalamayı düşürmez", () => {
    const sonuc = gelisimAlanOrtalamalari([
      cevap("Duygusal Gelişim Alanları", 5),
      cevap("Duygusal Gelişim Alanları", null),
      cevap("Duygusal Gelişim Alanları", 5),
    ]);

    const duygusal = sonuc.find(
      (a) => a.kategori === "Duygusal Gelişim Alanları",
    );
    expect(duygusal?.ortalama).toBe(5);
    expect(duygusal?.gozlemSayisi).toBe(2);
  });

  it("hiç cevaplanmamış alan listede kalır ama ortalaması null olur", () => {
    const sonuc = gelisimAlanOrtalamalari([
      cevap("Duygusal Gelişim Alanları", 4),
    ]);

    expect(sonuc).toHaveLength(3);
    const sosyal = sonuc.find((a) => a.kategori === "Sosyal Gelişim Alanları");
    expect(sosyal?.ortalama).toBeNull();
    expect(sosyal?.gozlemSayisi).toBe(0);
  });

  it("boş cevap listesi üç alanı da ölçülemedi olarak döndürür", () => {
    const sonuc = gelisimAlanOrtalamalari([]);
    expect(sonuc).toHaveLength(3);
    expect(sonuc.every((a) => a.ortalama === null)).toBe(true);
  });
});
