import { describe, expect, it } from "vitest";
import {
  jetonBicimiTutuyorMu,
  programAdresi,
  programHaftasi,
  programJetonuUret,
} from "./program-linki";

/** 2026-09-20 Pazar; haftaBasi() Pazartesi'ye çeker → 2026-09-14. */
const PAZAR = new Date("2026-09-20T00:00:00Z");
const BU_HAFTA = new Date("2026-09-14T00:00:00Z");

describe("programJetonuUret", () => {
  it("base64url alfabesinde 32 karakter üretir", () => {
    const jeton = programJetonuUret();
    expect(jeton).toHaveLength(32);
    expect(jeton).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("her çağrıda farklı jeton verir", () => {
    const jetonlar = new Set(
      Array.from({ length: 50 }, () => programJetonuUret()),
    );
    expect(jetonlar.size).toBe(50);
  });

  it("ürettiği jeton kendi biçim denetiminden geçer", () => {
    expect(jetonBicimiTutuyorMu(programJetonuUret())).toBe(true);
  });
});

describe("jetonBicimiTutuyorMu", () => {
  it("alakasız yolları eler", () => {
    // Tarayıcı eklentileri /program altına bunları deniyor; her biri
    // veritabanına gereksiz bir sorgu olurdu.
    expect(jetonBicimiTutuyorMu("favicon.ico")).toBe(false);
    expect(jetonBicimiTutuyorMu("kisa")).toBe(false);
    expect(jetonBicimiTutuyorMu("")).toBe(false);
  });

  it("base64url dışı karakteri reddeder", () => {
    expect(jetonBicimiTutuyorMu("abcdefghijklmnop+")).toBe(false);
    expect(jetonBicimiTutuyorMu("abcdefghijklmnop/")).toBe(false);
  });
});

describe("programHaftasi", () => {
  it("parametre yoksa bu haftaya düşer", () => {
    const sonuc = programHaftasi(undefined, PAZAR);
    expect(sonuc.capa).toEqual(BU_HAFTA);
    expect(sonuc.buHaftaMi).toBe(true);
  });

  it("çözülemeyen değeri bu haftaya çeker", () => {
    expect(programHaftasi("abc", PAZAR).capa).toEqual(BU_HAFTA);
  });

  it("gelecek haftayı açar", () => {
    const sonuc = programHaftasi("2026-09-23", PAZAR);
    expect(sonuc.capa).toEqual(new Date("2026-09-21T00:00:00Z"));
    expect(sonuc.buHaftaMi).toBe(false);
  });

  it("GEÇMİŞ haftayı açmaz, bu haftaya çeker", () => {
    // Sızan bir adres geçmiş danışan listesini vermemeli (Eylül 2026 kararı).
    const sonuc = programHaftasi("2026-09-07", PAZAR);
    expect(sonuc.capa).toEqual(BU_HAFTA);
    expect(sonuc.buHaftaMi).toBe(true);
  });

  it("bu haftanın içindeki bir günü bu hafta sayar", () => {
    const sonuc = programHaftasi("2026-09-17", PAZAR);
    expect(sonuc.capa).toEqual(BU_HAFTA);
    expect(sonuc.buHaftaMi).toBe(true);
  });
});

describe("programAdresi", () => {
  it("kök ile jetonu birleştirir", () => {
    expect(programAdresi("https://ornek.test", "JETON")).toBe(
      "https://ornek.test/program/JETON",
    );
  });

  it("kökteki fazla eğik çizgiyi yutar", () => {
    expect(programAdresi("https://ornek.test/", "JETON")).toBe(
      "https://ornek.test/program/JETON",
    );
  });

  it("kök boşsa göreli yol verir", () => {
    expect(programAdresi("", "JETON")).toBe("/program/JETON");
  });
});
