import { describe, expect, it } from "vitest";
import { atolyeIcerikGirdisiYaz, mufredatYeterliMi } from "./atolye-icerigi-metni";

describe("mufredatYeterliMi", () => {
  it("gerçek konu başlıkları olan müfredat yeterlidir", () => {
    expect(
      mufredatYeterliMi([
        { baslik: "Ressam Robot — elektrik devreleri", aciklama: "…" },
        { baslik: "Deprem ve yapı dayanıklılığı", aciklama: "…" },
        { baslik: "Elektriklenme ve statik elektrik", aciklama: "…" },
      ]),
    ).toBe(true);
  });

  it("yer tutucu başlıklar sayılmaz", () => {
    // Canlıdaki dolgu girdilerinin birebir biçimi.
    expect(
      mufredatYeterliMi([
        { baslik: "1. hafta uygulaması", aciklama: "Bilim Atölyesi — 1. hafta etkinlik ve gözlem konuları." },
        { baslik: "2. hafta uygulaması", aciklama: "Bilim Atölyesi — 2. hafta etkinlik ve gözlem konuları." },
        { baslik: "3. hafta uygulaması", aciklama: null },
      ]),
    ).toBe(false);
  });

  it("başlığı yer tutucu kalsa da gerçek açıklama sayılır", () => {
    // Açıklama zorunlu hale geldi; müfredatın gövdesi orada taşınıyor.
    expect(
      mufredatYeterliMi([
        { baslik: "1. hafta uygulaması", aciklama: "Temel kodlama kavramları: sıralama, döngüler ve koşullar; blok tabanlı araçlarla ilk proje." },
        { baslik: "2. hafta uygulaması", aciklama: "Sensörler ve motorlarla ışığa tepki veren basit robot tasarımı." },
        { baslik: "3. hafta uygulaması", aciklama: "Grup projesi: görev temelli robot yarışması ve hata ayıklama." },
      ]),
    ).toBe(true);
  });

  it("üç dolu haftadan azı yetmez", () => {
    expect(
      mufredatYeterliMi([
        { baslik: "Volkan patlaması", aciklama: null },
        { baslik: "2. hafta uygulaması", aciklama: null },
      ]),
    ).toBe(false);
  });

  it("boş müfredat yetmez", () => {
    expect(mufredatYeterliMi([])).toBe(false);
  });
});

describe("atolyeIcerikGirdisiYaz", () => {
  const girdi = {
    atolyeAdi: "Bilim Atölyesi",
    atolyeAciklamasi: "Deney ve gözlem temelli bilim etkinlikleri.",
    haftalar: [
      { hafta: 1, baslik: "Ressam Robot", aciklama: "Elektrik devresiyle çalışan robot." },
      { hafta: 2, baslik: "Deprem ve yapı dayanıklılığı", aciklama: null },
    ],
    beceriBasliklari: ["Bilimsel Düşünme Becerisi", "Gözlem ve Analiz Yeteneği"],
  };

  it("haftaları numarasıyla ve sırayla yazar", () => {
    const metin = atolyeIcerikGirdisiYaz(girdi);
    expect(metin).toContain("1. hafta — Ressam Robot: Elektrik devresiyle");
    expect(metin.indexOf("1. hafta")).toBeLessThan(metin.indexOf("2. hafta"));
  });

  it("açıklaması olmayan haftayı yalnızca başlıkla yazar — boş satır bırakmaz", () => {
    const metin = atolyeIcerikGirdisiYaz(girdi);
    expect(metin).toContain("2. hafta — Deprem ve yapı dayanıklılığı\n");
    expect(metin).not.toContain("Deprem ve yapı dayanıklılığı: ");
  });

  it("beceri başlıklarını ayrı bir bölümde verir", () => {
    const metin = atolyeIcerikGirdisiYaz(girdi);
    expect(metin).toContain("BU ATÖLYEDE DEĞERLENDİRİLEN BECERİLER:");
    expect(metin).toContain("Bilimsel Düşünme Becerisi, Gözlem ve Analiz Yeteneği");
  });

  it("beceri yoksa o bölümü hiç yazmaz", () => {
    const metin = atolyeIcerikGirdisiYaz({ ...girdi, beceriBasliklari: [] });
    expect(metin).not.toContain("DEĞERLENDİRİLEN BECERİLER");
  });
});
