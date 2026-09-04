import { describe, expect, it } from "vitest";
import {
  araliktakiGunler,
  gunlereBol,
  takvimAraligi,
  takvimKaydir,
} from "./takvim-verisi";

const gun = (metin: string) => new Date(`${metin}T00:00:00.000Z`);
const an = (metin: string) => new Date(`${metin}:00.000Z`);
const iso = (tarih: Date) => tarih.toISOString().slice(0, 10);

// 9 Eylül 2026 çarşamba.
const CARSAMBA = gun("2026-09-09");

describe("takvimAraligi", () => {
  it("gün görünümü tek günü kapsar", () => {
    const aralik = takvimAraligi("gun", CARSAMBA);
    expect([iso(aralik.ilk), iso(aralik.son)]).toEqual([
      "2026-09-09",
      "2026-09-10",
    ]);
  });

  it("hafta görünümü PAZARTESİDEN başlar", () => {
    // Çapa haftanın herhangi bir günü olabilir; aralık hep pazartesi–pazar.
    const aralik = takvimAraligi("hafta", CARSAMBA);
    expect([iso(aralik.ilk), iso(aralik.son)]).toEqual([
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("ay görünümü ayın tamamını kapsar", () => {
    const aralik = takvimAraligi("ay", CARSAMBA);
    expect([iso(aralik.ilk), iso(aralik.son)]).toEqual([
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("yıl sınırındaki ay doğru kapanır", () => {
    const aralik = takvimAraligi("ay", gun("2026-12-15"));
    expect([iso(aralik.ilk), iso(aralik.son)]).toEqual([
      "2026-12-01",
      "2027-01-01",
    ]);
  });

  it("şubatın uzunluğunu takvimden alır", () => {
    expect(iso(takvimAraligi("ay", gun("2028-02-10")).son)).toBe("2028-03-01");
  });
});

describe("takvimKaydir", () => {
  it("gün görünümünde bir gün ilerler", () => {
    expect(iso(takvimKaydir("gun", CARSAMBA, 1))).toBe("2026-09-10");
    expect(iso(takvimKaydir("gun", CARSAMBA, -1))).toBe("2026-09-08");
  });

  it("hafta görünümünde HAFTA BAŞINA hizalanarak kayar", () => {
    // Çarşambadan ileri gidince gelecek haftanın pazartesisi gelmeli,
    // gelecek çarşamba değil — yoksa başlık ile aralık ayrışırdı.
    expect(iso(takvimKaydir("hafta", CARSAMBA, 1))).toBe("2026-09-14");
    expect(iso(takvimKaydir("hafta", CARSAMBA, -1))).toBe("2026-08-31");
  });

  it("ay görünümünde ay başına hizalanarak kayar", () => {
    expect(iso(takvimKaydir("ay", CARSAMBA, 1))).toBe("2026-10-01");
    expect(iso(takvimKaydir("ay", gun("2026-01-20"), -1))).toBe("2025-12-01");
  });
});

describe("araliktakiGunler", () => {
  it("hafta için yedi gün üretir", () => {
    const gunler = araliktakiGunler(takvimAraligi("hafta", CARSAMBA));
    expect(gunler).toHaveLength(7);
    expect(iso(gunler[0])).toBe("2026-09-07");
    expect(iso(gunler[6])).toBe("2026-09-13");
  });

  it("ay için ayın gün sayısı kadar üretir", () => {
    expect(araliktakiGunler(takvimAraligi("ay", CARSAMBA))).toHaveLength(30);
    expect(
      araliktakiGunler(takvimAraligi("ay", gun("2026-02-10"))),
    ).toHaveLength(28);
  });
});

describe("gunlereBol", () => {
  const aralik = takvimAraligi("hafta", CARSAMBA);
  const randevular = [
    { id: "c", baslangic: an("2026-09-09T15:00") },
    { id: "a", baslangic: an("2026-09-07T09:00") },
    { id: "b", baslangic: an("2026-09-09T10:00") },
  ];

  it("randevusu OLMAYAN günler de listede kalır", () => {
    // Doluluk ancak boşluğun görünmesiyle okunuyor.
    const gruplar = gunlereBol(aralik, randevular);
    expect(gruplar).toHaveLength(7);
    expect(gruplar.filter((g) => g.randevular.length === 0)).toHaveLength(5);
  });

  it("gün içinde saate göre sıralar", () => {
    const gruplar = gunlereBol(aralik, randevular);
    const carsamba = gruplar.find((g) => iso(g.gun) === "2026-09-09");
    expect(carsamba?.randevular.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("günleri takvim sırasında verir", () => {
    const gruplar = gunlereBol(aralik, randevular);
    expect(gruplar.map((g) => iso(g.gun))).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("boş listede bile günleri üretir", () => {
    expect(gunlereBol(aralik, [])).toHaveLength(7);
  });
});
