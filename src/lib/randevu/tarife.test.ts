import { describe, expect, it } from "vitest";
import {
  duzenlemeBrutUcreti,
  KAYITLI_TARIFE,
  tarifeSecilebilirMi,
  tarifeSeciminiCoz,
  tarifeUcreti,
} from "./tarife";

const ikiTarifeli = { ucretKurus: 780000, eskiDanisanUcretKurus: 650000 };
const tekTarifeli = { ucretKurus: 320000, eskiDanisanUcretKurus: null };

describe("tarifeSeciminiCoz", () => {
  it("izinli seçimleri tanır", () => {
    expect(tarifeSeciminiCoz("guncel")).toBe("guncel");
    expect(tarifeSeciminiCoz("eski")).toBe("eski");
    expect(tarifeSeciminiCoz(KAYITLI_TARIFE)).toBe(KAYITLI_TARIFE);
  });

  it("tanımadığı değeri reddeder", () => {
    // Elle düzenlenmiş bir form alanı sessizce güncel tarifeye düşmemeli.
    expect(tarifeSeciminiCoz("bedava")).toBeNull();
    expect(tarifeSeciminiCoz("")).toBeNull();
  });
});

describe("tarifeUcreti", () => {
  it("güncel tarife ana ücreti verir", () => {
    expect(tarifeUcreti(ikiTarifeli, "guncel")).toBe(780000);
    expect(tarifeUcreti(tekTarifeli, "guncel")).toBe(320000);
  });

  it("eski danışan tarifesi ikinci ücreti verir", () => {
    expect(tarifeUcreti(ikiTarifeli, "eski")).toBe(650000);
  });

  it("ikinci ücreti olmayan hizmette 'eski' NULL döner", () => {
    // Sessizce güncel ücrete düşmek, indirim bekleyen bir randevuyu tam
    // fiyattan açardı; çağıran taraf bunu kesin ret sayıyor.
    expect(tarifeUcreti(tekTarifeli, "eski")).toBeNull();
  });

  it("sıfır ücret geçerli bir tarifedir", () => {
    // Ücretsiz hizmet var (katalogda 0 yazılabiliyor); 0 ile "tanımsız"
    // karıştırılmamalı.
    expect(tarifeUcreti({ ucretKurus: 0, eskiDanisanUcretKurus: 0 }, "eski")).toBe(0);
  });
});

describe("tarifeSecilebilirMi", () => {
  it("ikinci ücret varsa seçim sunulur", () => {
    expect(tarifeSecilebilirMi(ikiTarifeli)).toBe(true);
  });

  it("ikinci ücret yoksa seçim sunulmaz", () => {
    expect(tarifeSecilebilirMi(tekTarifeli)).toBe(false);
  });

  it("ikinci ücret sıfırsa yine seçim sunulur", () => {
    // Ücretsiz bir "eski danışan" tarifesi kurumun kararı olabilir.
    expect(tarifeSecilebilirMi({ ucretKurus: 100, eskiDanisanUcretKurus: 0 })).toBe(true);
  });
});

describe("duzenlemeBrutUcreti", () => {
  it("kayıtlı seçimde yazılı brüt ücreti OLDUĞU GİBİ döner", () => {
    // Regresyon: indirim geri eklenirse ücret her düzenlemede şişer.
    expect(duzenlemeBrutUcreti(KAYITLI_TARIFE, 650000, ikiTarifeli)).toBe(650000);
  });

  it("kayıtlı seçim katalogdan ETKİLENMEZ", () => {
    // Katalog zamlanmış olsa bile formu açıp notu değiştiren kullanıcı
    // ücreti farkında olmadan güncellememeli.
    expect(duzenlemeBrutUcreti(KAYITLI_TARIFE, 500000, ikiTarifeli)).toBe(500000);
  });

  it("güncel seçimi katalog ücretine geçirir", () => {
    expect(duzenlemeBrutUcreti("guncel", 500000, ikiTarifeli)).toBe(780000);
  });

  it("eski seçimi ikinci ücrete geçirir", () => {
    expect(duzenlemeBrutUcreti("eski", 500000, ikiTarifeli)).toBe(650000);
  });

  it("ikinci ücreti olmayan hizmette 'eski' NULL döner", () => {
    expect(duzenlemeBrutUcreti("eski", 500000, tekTarifeli)).toBeNull();
  });
});
