import { describe, expect, it } from "vitest";
import { ogrenciAramaKosulu } from "./ogrenci-arama";
import { aktifOgrenciKosulu } from "./durumlar";

const SUBE = "sube-umraniye";

describe("ogrenciAramaKosulu — ortak havuz ve kayıt şubesi", () => {
  it("boş sorgu iki şubenin bütün öğrencilerini getirir", () => {
    // Eylül 2026: öğrenciler ortak havuzda; çalışılan şube öğrenciyi SÜZMEZ.
    expect(ogrenciAramaKosulu("", { subeId: SUBE })).toEqual({});
  });

  it("isim aramasına şube karışmaz", () => {
    const kosul = ogrenciAramaKosulu("Şule", { subeId: SUBE });
    expect(kosul.branchId).toBeUndefined();
  });

  it("kayıt şubesi süzgeci öğrencinin etiketine iner", () => {
    const kosul = ogrenciAramaKosulu("Şule", {
      subeId: SUBE,
      kayitSubesiId: "sube-gunesli",
    });
    expect(kosul.branchId).toBe("sube-gunesli");
    expect(kosul.OR).toBeDefined();
  });

  it("aktif kapsam çalışılan şubenin GRUPLARINA bakar", () => {
    const kosul = ogrenciAramaKosulu("", { subeId: SUBE, kapsam: "aktif" });
    expect(kosul).toEqual(aktifOgrenciKosulu(SUBE));
  });

  it("aktif kapsamda arama ve kayıt şubesi birbirini ezmez", () => {
    const kosul = ogrenciAramaKosulu("Şule", {
      subeId: SUBE,
      kapsam: "aktif",
      kayitSubesiId: "sube-gunesli",
    });
    expect(kosul.branchId).toBe("sube-gunesli");
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
    expect(ogrenciAramaKosulu("   ", { subeId: SUBE })).toEqual({});
  });

  it("telefon yazıldığında veli numarası da aranır", () => {
    const kosul = ogrenciAramaKosulu("0532 111 22 33", { subeId: SUBE });
    expect(kosul.OR).toHaveLength(2);
    expect(kosul.OR?.[1]).toEqual({
      // Telefon `Veli` kaydında (§17.1); arama bağ tablosu üzerinden iniyor.
      guardians: { some: { veli: { searchPhone: { contains: "5321112233" } } } },
    });
  });

  it("kısmi numara da aranabilir", () => {
    // Koordinatör çoğu zaman son dört haneyi yazıyor.
    const kosul = ogrenciAramaKosulu("1122", { subeId: SUBE });
    expect(kosul.OR?.[1]).toEqual({
      guardians: { some: { veli: { searchPhone: { contains: "1122" } } } },
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

describe("ogrenciAramaKosulu — program süzgeci", () => {
  it("dönem verilince o dönemde AKTİF kaydı olanlar süzülür", () => {
    const kosul = ogrenciAramaKosulu("", { subeId: SUBE, donemId: "donem-1" });
    expect(kosul.branchId).toBeUndefined();
    expect(kosul.AND).toEqual([
      {
        enrollments: {
          some: { status: "AKTIF", group: { termId: "donem-1", branchId: SUBE } },
        },
      },
    ]);
  });

  it("dönem ve 'aktif programlarda' birlikte durur — biri diğerini ezmez", () => {
    const kosul = ogrenciAramaKosulu("", {
      subeId: SUBE,
      kapsam: "aktif",
      donemId: "donem-1",
    });
    // `kapsam` kendi `enrollments` koşulunu koyuyor; dönem AND dalında kalmalı.
    expect(kosul.enrollments).toEqual(aktifOgrenciKosulu(SUBE).enrollments);
    expect(kosul.AND).toHaveLength(1);
  });

  it("program verilmezse AND dalı hiç açılmaz", () => {
    expect(ogrenciAramaKosulu("", { subeId: SUBE }).AND).toBeUndefined();
  });

  it("kulüp verilince o kulüpte AKTİF kaydı olanlar süzülür", () => {
    const kosul = ogrenciAramaKosulu("", { subeId: SUBE, kulupId: "kulup-1" });
    expect(kosul.AND).toEqual([
      {
        enrollments: {
          some: { status: "AKTIF", group: { clubId: "kulup-1", branchId: SUBE } },
        },
      },
    ]);
  });
});
