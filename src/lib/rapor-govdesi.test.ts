import { describe, expect, it } from "vitest";
import { atolyeKademesiCikar, gelisimAlanlariCikar } from "./rapor-govdesi";
import type { SoruOrtalamasi } from "./puan-hesaplari";

function soru(
  kategori: string,
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

const ILGI = "İlgi ve Merak Alanları";
const YETENEK = "Yetenek Gelişim Alanları";

describe("atolyeKademesiCikar", () => {
  it("ilgi ve başarıyı doğru kategorilerden çıkarır", () => {
    // Örnek rapordaki Bilim Atölyesi değerleri: ilgi 4,72 · başarı 4,67
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Bilim Atölyesi",
      soruOrtalamalari: [
        soru(ILGI, 47.2, 10, 0),
        soru(YETENEK, 46.7, 10, 1),
      ],
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });

    expect(sonuc.ilgi?.kademe).toBe("YUKSEK");
    expect(sonuc.basari?.kademe).toBe("YUKSEK");
  });

  it("ilgi yüksek başarı düşük olduğunda kademeler ayrışır", () => {
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Astronomi Atölyesi",
      soruOrtalamalari: [soru(ILGI, 48, 10, 0), soru(YETENEK, 25, 10, 1)],
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });

    expect(sonuc.ilgi?.kademe).toBe("YUKSEK");
    expect(sonuc.basari?.kademe).toBe("DUSUK");
  });

  it("kategorisi eksik atölyede kademe üretilmez", () => {
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Yeni Atölye",
      soruOrtalamalari: [],
      katildigiOturumSayisi: 0,
      katilmadigiOturumSayisi: 2,
    });

    expect(sonuc.ilgi).toBeNull();
    expect(sonuc.basari).toBeNull();
    // Katılmadığı oturumlar yine de raporlanır.
    expect(sonuc.katilmadigiOturumSayisi).toBe(2);
  });
});

describe("gelisimAlanlariCikar", () => {
  const kazanimlar = new Map([
    ["Duygusal Gelişim Alanları", ["Duygu Düzenleme", "Empati Gelişimi"]],
    ["Sosyal Gelişim Alanları", ["Sosyal İnisiyatif"]],
  ]);

  it("grup ortalamasının üstündeki öğrenci için yaşıt kıyası yapar", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.64 }],
      new Map([["Duygusal Gelişim Alanları", 3.92]]),
      kazanimlar,
    );

    expect(sonuc[0].bant?.kademe).toBe("YUKSEK");
    expect(sonuc[0].cumle).toContain("yaşıtlarının üzerinde");
  });

  it("alan adını cümlede okunur biçime çevirir", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.0 }],
      new Map([["Duygusal Gelişim Alanları", 4.0]]),
      kazanimlar,
    );

    expect(sonuc[0].cumle).toContain("duygusal beceriler");
    expect(sonuc[0].cumle).not.toContain("Gelişim Alanları");
  });

  it("kazanımları cümleye tırnak içinde gömer", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.0 }],
      new Map([["Duygusal Gelişim Alanları", 4.0]]),
      kazanimlar,
    );

    expect(sonuc[0].cumle).toContain("duygu düzenleme ve empati gelişimi");
  });

  it("grup ortalaması yoksa yaşıt kıyası yapılmaz", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Sosyal Gelişim Alanları", ortalama: 4.8 }],
      new Map(),
      kazanimlar,
    );

    expect(sonuc[0].bant?.kademe).toBe("YUKSEK");
    expect(sonuc[0].cumle).not.toContain("yaşıt");
  });

  it("ölçülemeyen alan kademe almaz ve cümle üretilmez", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Bilişsel Gelişim Alanları", ortalama: null }],
      new Map(),
      kazanimlar,
    );

    expect(sonuc[0].bant).toBeNull();
    expect(sonuc[0].cumle).toBeNull();
  });
});
