import { describe, expect, it } from "vitest";
import { istanbulBugunu, randevuGecmisMi } from "./gecmis-kilidi";

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

/**
 * Rol kuralının testleri 25 Eylül 2026'da SİLİNDİ: geçmiş randevu kilidi
 * kaldırıldı, `randevular` TAM yetkisi olan herkes geçmişe randevu açıp
 * düzenliyor. Geriye kalan `randevuGecmisMi` yalnız SİLME kuralını besliyor
 * (günü geçmiş randevu silinmez, iptal edilir) — testleri o yüzden duruyor.
 */
describe("randevuGecmisMi — günü bitmiş randevu", () => {
  const ogleden = new Date("2026-09-17T12:00:00Z"); // 17 Eylül 15:00 İstanbul

  it("bugünün saati geçmiş randevusu hâlâ SİLİNEBİLİR", () => {
    expect(randevuGecmisMi(randevu("2026-09-17T09:00:00"), ogleden)).toBe(false);
  });

  it("bugünün ileri saatli randevusu silinebilir", () => {
    expect(randevuGecmisMi(randevu("2026-09-17T18:00:00"), ogleden)).toBe(false);
  });

  it("dünün son randevusu artık geçmiş", () => {
    expect(randevuGecmisMi(randevu("2026-09-16T23:30:00"), ogleden)).toBe(true);
  });

  it("gece yarısını geçer geçmez dün geçmişe düşer (UTC'de hâlâ dün olsa da)", () => {
    const geceBir = new Date("2026-09-16T22:00:00Z"); // 17 Eylül 01:00 İstanbul
    expect(randevuGecmisMi(randevu("2026-09-16T20:00:00"), geceBir)).toBe(true);
  });
});
