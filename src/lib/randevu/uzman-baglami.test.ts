import { describe, expect, it } from "vitest";
import { engelMesaji } from "./uzman-baglami";

const saat = (s: string) => new Date(`2026-09-20T${s}:00Z`);
const baglam = {
  mesailer: [],
  izinler: [],
  mevcutlar: [
    { id: "r1", baslangic: saat("10:00"), bitis: saat("11:00"), durum: "PLANLANDI" as const, iptal: false, branchId: "sube_gunesli", branch: { name: "Güneşli Tüzder" } },
    { id: "r2", baslangic: saat("12:00"), bitis: saat("13:00"), durum: "PLANLANDI" as const, iptal: false, branchId: "sube_umraniye", branch: { name: "Ümraniye Tüzder" } },
  ],
};

describe("engelMesaji", () => {
  it("çakışan randevu öbür şubedeyse şube adını ekler — takvimde görünmüyor", () => {
    expect(
      engelMesaji({ tur: "cakisma", mesaj: "Uzmanın bu saatte başka bir randevusu var.", cakisanId: "r1" }, baglam, "sube_umraniye"),
    ).toBe("Uzmanın bu saatte başka bir randevusu var (Güneşli Tüzder şubesinde).");
  });

  it("aynı şubedeki çakışmada mesaj değişmez", () => {
    expect(
      engelMesaji({ tur: "cakisma", mesaj: "Uzmanın bu saatte başka bir randevusu var.", cakisanId: "r2" }, baglam, "sube_umraniye"),
    ).toBe("Uzmanın bu saatte başka bir randevusu var.");
  });

  it("izin ve mesai mesajlarına dokunmaz", () => {
    expect(engelMesaji({ tur: "izin", mesaj: "Uzman bu tarihte izinli." }, baglam, "sube_umraniye")).toBe(
      "Uzman bu tarihte izinli.",
    );
  });
});
