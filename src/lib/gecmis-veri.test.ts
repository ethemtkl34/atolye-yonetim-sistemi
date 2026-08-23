import { describe, expect, it } from "vitest";
import {
  gecmisProgramHatasi,
  gecmisProgramKaydi,
  type GecmisProgramliKayit,
} from "./gecmis-veri";

function donemKaydi(ad: string, gecmis: boolean): GecmisProgramliKayit {
  return { group: { name: "A-1", term: { name: ad, gecmisVerisi: gecmis }, club: null } };
}

function kulupKaydi(ad: string, gecmis: boolean): GecmisProgramliKayit {
  return { group: { name: "1. Grup", term: null, club: { name: ad, gecmisVerisi: gecmis } } };
}

describe("gecmisProgramKaydi", () => {
  it("aktarılmış dönemi yakalar", () => {
    expect(gecmisProgramKaydi(donemKaydi("2025-2026 Kış 1. Kur", true))).toBe(true);
  });

  it("aktarılmış kulübü yakalar", () => {
    expect(gecmisProgramKaydi(kulupKaydi("Drama Kulübü 2026", true))).toBe(true);
  });

  it("güncel programa dokunmaz", () => {
    expect(gecmisProgramKaydi(donemKaydi("2026 Sonbahar", false))).toBe(false);
    expect(gecmisProgramKaydi(kulupKaydi("Yaz Bilim Kulübü", false))).toBe(false);
  });
});

describe("gecmisProgramHatasi", () => {
  it("program adını ve gidilecek yeri söyler", () => {
    const metin = gecmisProgramHatasi([donemKaydi("2025-2026 Kış 1. Kur", true)]);
    expect(metin).toContain("2025-2026 Kış 1. Kur");
    expect(metin).toContain("Arşiv raporları");
  });

  it("aynı dönemin iki grubunu tek kez yazar", () => {
    // Yıllık öğrencinin aynı dönemde iki kaydı olabilir; hata metninde
    // dönem adı iki kez geçmemeli.
    const metin = gecmisProgramHatasi([
      donemKaydi("2025-2026 Bahar 2. Kur", true),
      donemKaydi("2025-2026 Bahar 2. Kur", true),
    ]);
    expect(metin.match(/Bahar 2\. Kur/g)).toHaveLength(1);
  });

  it("dönem ve kulübü birlikte listeler", () => {
    const metin = gecmisProgramHatasi([
      donemKaydi("2025 Yaz Atölyesi", true),
      kulupKaydi("Robotik Kodlama Kulübü 2026", true),
    ]);
    expect(metin).toContain("2025 Yaz Atölyesi, Robotik Kodlama Kulübü 2026");
  });
});
