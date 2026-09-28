import { describe, expect, it } from "vitest";
import { randevuSemasi, randevuDuzenleSemasi } from "./sema";

/**
 * §17.4 — Seans saatlerinin doğrulanması (28 Eylül 2026).
 *
 * Bitiş saati eklendikten sonra formun sunucuya "başlangıçtan önce biten"
 * bir aralık geçirebilmesi çakışma hesabını sessizce bozardı; kural burada
 * ve iki şemada da aynı.
 */

const temel = {
  uzmanId: "uz1",
  hizmetId: "hz1",
  tarih: "2026-09-28",
  saat: "10:00",
  indirimYuzde: "0",
  indirimNotu: "",
  not: "",
  veliId: "v1",
  yeniVeliAdi: "",
  yeniVeliTelefon: "",
  ogrenciId: "",
  yeniOgrenciAdi: "",
  yeniOgrenciSoyadi: "",
  yeniOgrenciDogumTarihi: "",
  subeId: "",
  haftaSayisi: "1",
};

const bitisHatasi = (sonuc: ReturnType<typeof randevuSemasi.safeParse>) =>
  sonuc.success
    ? null
    : (sonuc.error.issues.find((h) => h.path[0] === "bitisSaati")?.message ?? null);

describe("randevuSemasi — bitiş saati", () => {
  it("boş bitiş kabul edilir (süre katalogdan gelir)", () => {
    const sonuc = randevuSemasi.safeParse({ ...temel, bitisSaati: "" });
    expect(sonuc.success).toBe(true);
    if (sonuc.success) expect(sonuc.data.bitisSaati).toBeNull();
  });

  it("başlangıçtan sonraki bitiş kabul edilir", () => {
    const sonuc = randevuSemasi.safeParse({ ...temel, bitisSaati: "11:30" });
    expect(sonuc.success).toBe(true);
    if (sonuc.success) expect(sonuc.data.bitisSaati).toBe("11:30");
  });

  it("başlangıçla AYNI bitiş reddedilir", () => {
    // Sıfır süreli aralık çakışma hesabını sessizce bozardı.
    expect(bitisHatasi(randevuSemasi.safeParse({ ...temel, bitisSaati: "10:00" }))).toBe(
      "Bitiş saati başlangıçtan sonra olmalı.",
    );
  });

  it("başlangıçtan ÖNCEKİ bitiş reddedilir", () => {
    // Gece yarısını aşan seans da bu dala düşüyor: randevu saatleri tek bir
    // günün içinde tutuluyor, ertesi güne taşan aralık yanlış güne düşerdi.
    expect(bitisHatasi(randevuSemasi.safeParse({ ...temel, bitisSaati: "09:00" }))).toBe(
      "Bitiş saati başlangıçtan sonra olmalı.",
    );
  });

  it("biçimsiz bitiş reddedilir", () => {
    expect(bitisHatasi(randevuSemasi.safeParse({ ...temel, bitisSaati: "yarın" }))).toBe(
      "Bitiş saati SS:DD biçiminde olmalı",
    );
  });
});

describe("randevuDuzenleSemasi — aynı kural", () => {
  const duzenle = {
    ...temel,
    danisanIslemi: "koru",
    veliAdi: "",
    veliTelefon: "",
    ogrenciAd: "",
    ogrenciSoyad: "",
    ogrenciDogumTarihi: "",
  };

  it("geçerli aralığı kabul eder", () => {
    expect(randevuDuzenleSemasi.safeParse({ ...duzenle, bitisSaati: "12:00" }).success).toBe(
      true,
    );
  });

  it("ters aralığı reddeder", () => {
    const sonuc = randevuDuzenleSemasi.safeParse({ ...duzenle, bitisSaati: "08:00" });
    expect(sonuc.success).toBe(false);
  });
});
