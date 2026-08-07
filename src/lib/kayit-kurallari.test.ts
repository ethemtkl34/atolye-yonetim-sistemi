import { describe, expect, it } from "vitest";
import { kontenjanDurumu } from "./kayit-kurallari";

describe("kontenjanDurumu", () => {
  it("kontenjan dolduğunda dolu olarak işaretler", () => {
    expect(kontenjanDurumu(12, 12).dolu).toBe(true);
    expect(kontenjanDurumu(12, 11).dolu).toBe(false);
    expect(kontenjanDurumu(12, 11).kalan).toBe(1);
  });

  it("kontenjan aşılmışsa kalan sayıyı negatife düşürmez", () => {
    const durum = kontenjanDurumu(10, 13);
    expect(durum.kalan).toBe(0);
    expect(durum.dolu).toBe(true);
    expect(durum.yuzde).toBe(100);
  });
});
