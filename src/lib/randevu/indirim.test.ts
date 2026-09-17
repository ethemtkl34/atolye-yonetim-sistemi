import { describe, expect, it } from "vitest";
import {
  MEVCUT_INDIRIM,
  indirimSeciminiCoz,
  kayitliYuzde,
  yuzdeIndirimi,
} from "./indirim";

describe("yuzdeIndirimi", () => {
  it("eski CRM'deki gerçek tutarları verir", () => {
    expect(yuzdeIndirimi(320_000, 5)).toBe(16_000); // Kardeş: ₺3.200 → ₺3.040
    expect(yuzdeIndirimi(780_000, 10)).toBe(78_000); // Kampanya 10: ₺7.800 → ₺7.020
    expect(yuzdeIndirimi(290_000, 25)).toBe(72_500);
  });

  it("kuruşa yuvarlar", () => {
    expect(yuzdeIndirimi(333, 5)).toBe(17); // 16,65 kuruş
  });
});

describe("kayitliYuzde", () => {
  it("indirimsiz randevu 0", () => {
    expect(kayitliYuzde(320_000, 0)).toBe(0);
  });

  it("listedeki orana denk gelen tutar o oran", () => {
    expect(kayitliYuzde(320_000, 16_000)).toBe(5);
    expect(kayitliYuzde(780_000, 390_000)).toBe(50);
  });

  it("listede olmayan tutar null (düzenlemede korunur)", () => {
    expect(kayitliYuzde(320_000, 57_920)).toBeNull(); // %18,1
  });
});

describe("indirimSeciminiCoz", () => {
  it("izinli yüzdeler, indirim yok ve mevcut", () => {
    expect(indirimSeciminiCoz("0")).toBe(0);
    expect(indirimSeciminiCoz("")).toBe(0);
    expect(indirimSeciminiCoz("25")).toBe(25);
    expect(indirimSeciminiCoz(MEVCUT_INDIRIM)).toBe(MEVCUT_INDIRIM);
  });

  it("listede olmayan oran reddedilir — formu elle değiştirmek işe yaramaz", () => {
    expect(indirimSeciminiCoz("20")).toBeNull();
    expect(indirimSeciminiCoz("100")).toBeNull();
    expect(indirimSeciminiCoz("-5")).toBeNull();
    expect(indirimSeciminiCoz("abc")).toBeNull();
  });
});
