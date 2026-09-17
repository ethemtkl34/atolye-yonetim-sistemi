import { describe, expect, it } from "vitest";
import {
  gecmisRandevuyuDuzenleyebilirMi,
  istanbulBugunu,
  randevuGecmisMi,
} from "./gecmis-kilidi";

/** Randevu saatleri duvar saati olarak UTC alanlarında: "17 Eylül 14:00" → 14:00Z. */
const randevu = (metin: string) => new Date(`${metin}Z`);

describe("istanbulBugunu", () => {
  it("İstanbul'un gece yarısını esas alır, UTC'ninkini değil", () => {
    // 17 Eylül 01:30 İstanbul = 16 Eylül 22:30 UTC. UTC tarihi hâlâ 16'sı.
    expect(istanbulBugunu(new Date("2026-09-16T22:30:00Z"))).toEqual(
      new Date("2026-09-17T00:00:00Z"),
    );
  });

  it("gün içinde aynı tarihi verir", () => {
    expect(istanbulBugunu(new Date("2026-09-17T12:00:00Z"))).toEqual(
      new Date("2026-09-17T00:00:00Z"),
    );
  });
});

describe("randevuGecmisMi — gün bitince kilit", () => {
  const ogleden = new Date("2026-09-17T12:00:00Z"); // 17 Eylül 15:00 İstanbul

  it("bugünün saati geçmiş randevusu hâlâ AÇIK", () => {
    expect(randevuGecmisMi(randevu("2026-09-17T09:00:00"), ogleden)).toBe(false);
  });

  it("bugünün ileri saatli randevusu açık", () => {
    expect(randevuGecmisMi(randevu("2026-09-17T18:00:00"), ogleden)).toBe(false);
  });

  it("dünün son randevusu kilitli", () => {
    expect(randevuGecmisMi(randevu("2026-09-16T23:30:00"), ogleden)).toBe(true);
  });

  it("gece yarısını geçer geçmez dün kilitlenir (UTC'de hâlâ dün olsa da)", () => {
    const geceBir = new Date("2026-09-16T22:00:00Z"); // 17 Eylül 01:00 İstanbul
    expect(randevuGecmisMi(randevu("2026-09-16T20:00:00"), geceBir)).toBe(true);
  });
});

describe("gecmisRandevuyuDuzenleyebilirMi", () => {
  it("Kurum ve Şube Yöneticisi düzenler", () => {
    expect(gecmisRandevuyuDuzenleyebilirMi(["ADMIN"])).toBe(true);
    expect(gecmisRandevuyuDuzenleyebilirMi(["SUBE_YONETICISI"])).toBe(true);
    expect(
      gecmisRandevuyuDuzenleyebilirMi(["SUBE_YONETICISI", "ATOLYE_PSIKOLOGU"]),
    ).toBe(true);
  });

  it("koordinatör, psikolog ve danışma masası düzenleyemez", () => {
    expect(gecmisRandevuyuDuzenleyebilirMi(["KOORDINATOR"])).toBe(false);
    expect(gecmisRandevuyuDuzenleyebilirMi(["ATOLYE_PSIKOLOGU"])).toBe(false);
    expect(gecmisRandevuyuDuzenleyebilirMi(["DANISMA_GOREVLISI"])).toBe(false);
    expect(
      gecmisRandevuyuDuzenleyebilirMi(["KOORDINATOR", "TEST_UYGULAYICISI", "DANISMA_GOREVLISI"]),
    ).toBe(false);
  });
});
