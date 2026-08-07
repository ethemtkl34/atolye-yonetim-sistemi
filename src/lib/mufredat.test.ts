import { describe, expect, it } from "vitest";
import {
  haftaAraliginda,
  mufredatAnahtari,
  mufredatHaritasi,
  oturumKonusu,
} from "./mufredat";

describe("mufredatHaritasi + oturumKonusu", () => {
  const girdiler = [
    {
      weekNumber: 1,
      workshopTypeId: "satranc",
      baslik: "Açılış ilkeleri",
      aciklama: "Merkez kontrolü",
    },
    {
      weekNumber: 2,
      workshopTypeId: "satranc",
      baslik: "Çatal ve şiş",
      aciklama: null,
    },
    {
      weekNumber: 1,
      workshopTypeId: "drama",
      baslik: "Tanışma oyunları",
      aciklama: null,
    },
  ];

  it("hafta × atölye ikilisini doğru konuya götürür", () => {
    const harita = mufredatHaritasi(girdiler);
    expect(oturumKonusu(harita, 1, "satranc")).toEqual({
      baslik: "Açılış ilkeleri",
      aciklama: "Merkez kontrolü",
    });
    expect(oturumKonusu(harita, 1, "drama")).toEqual({
      baslik: "Tanışma oyunları",
      aciklama: null,
    });
  });

  it("girilmemiş hafta veya atölye için null döner", () => {
    const harita = mufredatHaritasi(girdiler);
    expect(oturumKonusu(harita, 3, "satranc")).toBeNull();
    expect(oturumKonusu(harita, 2, "drama")).toBeNull();
  });

  it("telafi günü (hafta numarası null) hiç konu almaz", () => {
    // Telafi günü kaçırılan haftayı tekrarlar; oturumdan hangi haftanın
    // içeriği olduğu bilinemez, bu yüzden bilerek boş.
    const harita = mufredatHaritasi(girdiler);
    expect(oturumKonusu(harita, null, "satranc")).toBeNull();
  });

  it("anahtar bileşimi hafta ve atölyeyi karıştırmaz", () => {
    expect(mufredatAnahtari(12, "a")).not.toBe(mufredatAnahtari(1, "2a"));
  });
});

describe("haftaAraliginda", () => {
  it("1..toplam aralığını kabul eder, dışını reddeder", () => {
    expect(haftaAraliginda(1, 10)).toBe(true);
    expect(haftaAraliginda(10, 10)).toBe(true);
    expect(haftaAraliginda(0, 10)).toBe(false);
    expect(haftaAraliginda(11, 10)).toBe(false);
  });

  it("tam sayı olmayan ve negatif haftaları reddeder", () => {
    expect(haftaAraliginda(2.5, 10)).toBe(false);
    expect(haftaAraliginda(-3, 10)).toBe(false);
    expect(haftaAraliginda(Number.NaN, 10)).toBe(false);
  });

  it("tek haftalık programda yalnızca 1 geçerlidir", () => {
    expect(haftaAraliginda(1, 1)).toBe(true);
    expect(haftaAraliginda(2, 1)).toBe(false);
  });
});
