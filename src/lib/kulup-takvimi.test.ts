import { describe, expect, it } from "vitest";
import {
  gunEklemePlani,
  gunSilmePlani,
  gunTasimaPlani,
} from "./kulup-takvimi";

function t(metin: string): Date {
  return new Date(`${metin}T00:00:00.000Z`);
}

/** 3 günlük örnek takvim: 1. hafta 04, 2. hafta 11, 3. hafta 18 Temmuz. */
const TAKVIM = [t("2026-07-04"), t("2026-07-11"), t("2026-07-18")];

describe("gunEklemePlani", () => {
  it("sona eklenen gün kimseyi kaydırmaz", () => {
    const plan = gunEklemePlani(TAKVIM, t("2026-07-25"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.haftaNo).toBe(4);
    expect(plan.kaymalar).toEqual([]);
    expect(plan.yeniTarihler.map((d) => d.toISOString())).toEqual([
      t("2026-07-04"),
      t("2026-07-11"),
      t("2026-07-18"),
      t("2026-07-25"),
    ].map((d) => d.toISOString()));
  });

  it("araya eklenen gün sonraki haftaları bir ileri kaydırır", () => {
    const plan = gunEklemePlani(TAKVIM, t("2026-07-08"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.haftaNo).toBe(2);
    expect(plan.kaymalar).toEqual([
      { eski: 2, yeni: 3 },
      { eski: 3, yeni: 4 },
    ]);
  });

  it("başa eklenen gün bütün haftaları kaydırır", () => {
    const plan = gunEklemePlani(TAKVIM, t("2026-07-01"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.haftaNo).toBe(1);
    expect(plan.kaymalar).toEqual([
      { eski: 1, yeni: 2 },
      { eski: 2, yeni: 3 },
      { eski: 3, yeni: 4 },
    ]);
  });

  it("takvimdeki tarihi tekrar eklemeyi reddeder", () => {
    expect(gunEklemePlani(TAKVIM, t("2026-07-11"))).toHaveProperty("hata");
  });

  it("sırasız verilen listeyi kendi sıralar", () => {
    const plan = gunEklemePlani(
      [TAKVIM[2], TAKVIM[0], TAKVIM[1]],
      t("2026-07-08"),
    );
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.haftaNo).toBe(2);
  });
});

describe("gunSilmePlani", () => {
  it("ortadaki günü silince sonrakiler geri kayar", () => {
    const plan = gunSilmePlani(TAKVIM, t("2026-07-11"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.haftaNo).toBe(2);
    expect(plan.kaymalar).toEqual([{ eski: 3, yeni: 2 }]);
    expect(plan.yeniTarihler).toHaveLength(2);
  });

  it("son günü silmek kimseyi kaydırmaz", () => {
    const plan = gunSilmePlani(TAKVIM, t("2026-07-18"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.haftaNo).toBe(3);
    expect(plan.kaymalar).toEqual([]);
  });

  it("takvimde olmayan tarihi reddeder", () => {
    expect(gunSilmePlani(TAKVIM, t("2026-07-09"))).toHaveProperty("hata");
  });

  it("tek günlü takvimin son gününü silmeyi reddeder", () => {
    expect(gunSilmePlani([t("2026-07-04")], t("2026-07-04"))).toHaveProperty(
      "hata",
    );
  });
});

describe("gunTasimaPlani", () => {
  it("sıra değişmeyen taşımada kayma olmaz", () => {
    // 11 Temmuz → 12 Temmuz: hâlâ 2. sırada.
    const plan = gunTasimaPlani(TAKVIM, t("2026-07-11"), t("2026-07-12"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.eskiHaftaNo).toBe(2);
    expect(plan.yeniHaftaNo).toBe(2);
    expect(plan.kaymalar).toEqual([]);
  });

  it("ileri taşınan gün aradakileri geri kaydırır", () => {
    // 1. hafta (04) sona (20'ye) taşınır: eski 2 ve 3, 1 ve 2 olur.
    const plan = gunTasimaPlani(TAKVIM, t("2026-07-04"), t("2026-07-20"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.eskiHaftaNo).toBe(1);
    expect(plan.yeniHaftaNo).toBe(3);
    expect(plan.kaymalar).toEqual([
      { eski: 2, yeni: 1 },
      { eski: 3, yeni: 2 },
    ]);
  });

  it("geri taşınan gün aradakileri ileri kaydırır", () => {
    // 3. hafta (18) başa (01'e) taşınır: eski 1 ve 2, 2 ve 3 olur.
    const plan = gunTasimaPlani(TAKVIM, t("2026-07-18"), t("2026-07-01"));
    if ("hata" in plan) throw new Error(plan.hata);
    expect(plan.eskiHaftaNo).toBe(3);
    expect(plan.yeniHaftaNo).toBe(1);
    expect(plan.kaymalar).toEqual([
      { eski: 1, yeni: 2 },
      { eski: 2, yeni: 3 },
    ]);
  });

  it("aynı tarihe taşımayı ve dolu hedefi reddeder", () => {
    expect(
      gunTasimaPlani(TAKVIM, t("2026-07-11"), t("2026-07-11")),
    ).toHaveProperty("hata");
    expect(
      gunTasimaPlani(TAKVIM, t("2026-07-11"), t("2026-07-18")),
    ).toHaveProperty("hata");
    expect(
      gunTasimaPlani(TAKVIM, t("2026-07-09"), t("2026-07-10")),
    ).toHaveProperty("hata");
  });
});
