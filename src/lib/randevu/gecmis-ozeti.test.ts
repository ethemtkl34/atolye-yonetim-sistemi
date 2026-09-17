import { describe, expect, it } from "vitest";
import { gecmisOzeti, gecmisiAyir, type OzetGirdisi } from "./gecmis-ozeti";

const BUGUN = new Date("2026-09-17T00:00:00Z");
const s = (tarih: string, durum: OzetGirdisi["durum"], net: number | null = 100_000) => ({
  baslangic: new Date(`${tarih}Z`),
  durum,
  netUcretKurus: net,
});

describe("gecmisOzeti", () => {
  it("durumları sayar, ciroya yalnız gerçekleşeni katar", () => {
    const ozet = gecmisOzeti(
      [
        s("2026-09-10T10:00:00", "GERCEKLESTI", 250_000),
        s("2026-09-11T10:00:00", "GELMEDI"),
        s("2026-09-12T10:00:00", "IPTAL"),
        s("2026-09-16T10:00:00", "PLANLANDI"),
        s("2026-09-17T09:00:00", "PLANLANDI"),
        s("2026-09-20T09:00:00", "PLANLANDI"),
      ],
      BUGUN,
    );
    expect(ozet).toEqual({
      toplam: 6,
      gerceklesti: 1,
      gelmedi: 1,
      iptal: 1,
      yaklasan: 2, // bugünkü ve 20 Eylül
      isaretsiz: 1, // 16 Eylül
      ciroKurus: 250_000,
    });
  });

  it("başka şubenin (ücreti gizli) gerçekleşen seansı sayılır, ciroya girmez", () => {
    const ozet = gecmisOzeti([s("2026-09-10T10:00:00", "GERCEKLESTI", null)], BUGUN);
    expect(ozet.gerceklesti).toBe(1);
    expect(ozet.ciroKurus).toBe(0);
  });
});

describe("gecmisiAyir", () => {
  it("yaklaşanlar yakından uzağa, geçmiş yeniden eskiye; gelecekteki iptal geçmişte", () => {
    const { yaklasan, gecmis } = gecmisiAyir(
      [
        s("2026-09-10T10:00:00", "GERCEKLESTI"),
        s("2026-09-25T10:00:00", "PLANLANDI"),
        s("2026-09-17T09:00:00", "PLANLANDI"),
        s("2026-09-30T10:00:00", "IPTAL"),
        s("2026-09-15T10:00:00", "GELMEDI"),
      ],
      BUGUN,
    );
    expect(yaklasan.map((r) => r.baslangic.toISOString().slice(0, 10))).toEqual([
      "2026-09-17",
      "2026-09-25",
    ]);
    expect(gecmis.map((r) => r.baslangic.toISOString().slice(0, 10))).toEqual([
      "2026-09-30",
      "2026-09-15",
      "2026-09-10",
    ]);
  });
});
