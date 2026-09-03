import { describe, expect, it } from "vitest";
import { ogrenciAramaKosulu } from "./ogrenci-arama";
import { aktifOgrenciKosulu } from "./durumlar";

const SUBE = "sube-umraniye";

describe("ogrenciAramaKosulu — şube süzgeci", () => {
  it("boş sorguda bile şubeyi süzer", () => {
    // Öğrenci arama sistemdeki tek öğrenci giriş kapısı: burada şube
    // düşerse liste, seçiciler ve dashboard birlikte sızdırır.
    expect(ogrenciAramaKosulu("", { subeId: SUBE })).toEqual({
      branchId: SUBE,
    });
  });

  it("isim aramasında şube kaybolmaz", () => {
    const kosul = ogrenciAramaKosulu("Şule", { subeId: SUBE });
    expect(kosul.branchId).toBe(SUBE);
  });

  it("aktif kapsamda şube süzgeci grup koşuluna da iner", () => {
    const kosul = ogrenciAramaKosulu("", { subeId: SUBE, kapsam: "aktif" });
    expect(kosul).toEqual(aktifOgrenciKosulu(SUBE));
  });

  it("aktif kapsamda arama koşulu şube koşulunu ezmez", () => {
    // İkisi tek nesnede birleşiyor; yayma sırası bozulursa `branchId`
    // silinebilirdi.
    const kosul = ogrenciAramaKosulu("Şule", { subeId: SUBE, kapsam: "aktif" });
    expect(kosul.branchId).toBe(SUBE);
    expect(kosul.enrollments).toBeDefined();
    expect(kosul.OR).toBeDefined();
  });
});

describe("ogrenciAramaKosulu — sorgunun çözümlenmesi", () => {
  it("ismi Türkçe karakterlerden arındırıp arar", () => {
    // `Student.searchName` sütunu kaydederken normalize ediliyor;
    // sorgu da aynı biçime indirgenmezse "Şule" hiçbir şey bulmaz.
    const kosul = ogrenciAramaKosulu("Şule Çınar", { subeId: SUBE });
    expect(kosul.OR?.[0]).toEqual({ searchName: { contains: "sule cinar" } });
  });

  it("baştaki ve sondaki boşluk sonucu değiştirmez", () => {
    expect(ogrenciAramaKosulu("  Şule  ", { subeId: SUBE })).toEqual(
      ogrenciAramaKosulu("Şule", { subeId: SUBE }),
    );
  });

  it("yalnızca boşluktan oluşan sorgu arama sayılmaz", () => {
    expect(ogrenciAramaKosulu("   ", { subeId: SUBE })).toEqual({
      branchId: SUBE,
    });
  });

  it("telefon yazıldığında veli numarası da aranır", () => {
    const kosul = ogrenciAramaKosulu("0532 111 22 33", { subeId: SUBE });
    expect(kosul.OR).toHaveLength(2);
    expect(kosul.OR?.[1]).toEqual({
      guardians: { some: { searchPhone: { contains: "5321112233" } } },
    });
  });

  it("kısmi numara da aranabilir", () => {
    // Koordinatör çoğu zaman son dört haneyi yazıyor.
    const kosul = ogrenciAramaKosulu("1122", { subeId: SUBE });
    expect(kosul.OR?.[1]).toEqual({
      guardians: { some: { searchPhone: { contains: "1122" } } },
    });
  });

  it("üç rakamdan kısa girdide veli taraması yapılmaz", () => {
    // Tek hane yüzünden bütün velileri taramanın anlamı yok.
    expect(ogrenciAramaKosulu("12", { subeId: SUBE }).OR).toHaveLength(1);
    expect(ogrenciAramaKosulu("Ali", { subeId: SUBE }).OR).toHaveLength(1);
  });

  it("isim ve telefon aynı kutudan çalışır", () => {
    // Arama kutusu tek; hangisinin yazıldığı girdiden anlaşılıyor.
    expect(ogrenciAramaKosulu("Ali 532", { subeId: SUBE }).OR).toHaveLength(2);
  });
});
