import { describe, expect, it } from "vitest";
import {
  gunEkle,
  grupTarihi,
  grupZamani,
  haftaCapasi,
  haftaSonuBicimle,
  haftaSonuMu,
  tarihBicimle,
  tarihCozumle,
  tarihGunleBicimle,
  tarihMetni,
} from "./tarih";

describe("tarihCozumle", () => {
  it("geçerli tarihi UTC gece yarısına sabitler", () => {
    const tarih = tarihCozumle("2026-10-17")!;
    expect(tarih.getUTCFullYear()).toBe(2026);
    expect(tarih.getUTCMonth()).toBe(9);
    expect(tarih.getUTCDate()).toBe(17);
    expect(tarih.getUTCHours()).toBe(0);
  });

  it("takvimde olmayan tarihi reddeder", () => {
    // Date yapıcısı 31 Şubat'ı sessizce 3 Mart'a çevirir; bu kabul edilmemeli.
    expect(tarihCozumle("2026-02-31")).toBeNull();
    expect(tarihCozumle("2026-13-01")).toBeNull();
    expect(tarihCozumle("17.10.2026")).toBeNull();
  });

  it("çözümleme ve metne çevirme birbirinin tersi", () => {
    expect(tarihMetni(tarihCozumle("2026-11-01")!)).toBe("2026-11-01");
  });
});

describe("tarihBicimle", () => {
  it("Türkçe ay adıyla biçimlendirir", () => {
    expect(tarihBicimle(tarihCozumle("2026-10-17")!)).toBe("17 Ekim 2026");
    expect(tarihBicimle(tarihCozumle("2026-03-08")!)).toBe("8 Mart 2026");
  });

  it("gün adını da ekleyebilir", () => {
    expect(tarihGunleBicimle(tarihCozumle("2026-10-17")!)).toBe(
      "17 Ekim 2026, Cumartesi",
    );
  });
});

describe("haftaSonuMu", () => {
  it("cumartesi ve pazarı hafta sonu sayar", () => {
    expect(haftaSonuMu(tarihCozumle("2026-10-17")!)).toBe(true); // Cumartesi
    expect(haftaSonuMu(tarihCozumle("2026-10-18")!)).toBe(true); // Pazar
    expect(haftaSonuMu(tarihCozumle("2026-10-19")!)).toBe(false); // Pazartesi
  });
});

describe("haftaCapasi", () => {
  it("cumartesiyi olduğu gibi bırakır", () => {
    expect(tarihMetni(haftaCapasi(tarihCozumle("2026-10-17")!)!)).toBe(
      "2026-10-17",
    );
  });

  it("pazarı aynı hafta sonunun cumartesisine çeker", () => {
    // Koordinatör takvimden pazarı seçse de aynı hafta kaydedilmeli.
    expect(tarihMetni(haftaCapasi(tarihCozumle("2026-10-18")!)!)).toBe(
      "2026-10-17",
    );
  });

  it("hafta içi tarihi reddeder", () => {
    expect(haftaCapasi(tarihCozumle("2026-10-20")!)).toBeNull();
  });
});

describe("grupTarihi", () => {
  const cumartesi = tarihCozumle("2026-10-17")!;

  it("cumartesi grubunu çapa tarihinde toplar", () => {
    expect(tarihMetni(grupTarihi(cumartesi, "CUMARTESI"))).toBe("2026-10-17");
  });

  it("pazar grubunu ertesi günde toplar", () => {
    expect(tarihMetni(grupTarihi(cumartesi, "PAZAR"))).toBe("2026-10-18");
  });
});

describe("gunEkle", () => {
  it("ay sınırını doğru geçer", () => {
    expect(tarihMetni(gunEkle(tarihCozumle("2026-10-31")!, 1))).toBe(
      "2026-11-01",
    );
  });

  it("yıl sınırını doğru geçer", () => {
    expect(tarihMetni(gunEkle(tarihCozumle("2026-12-31")!, 1))).toBe(
      "2027-01-01",
    );
  });
});

describe("haftaSonuBicimle", () => {
  it("aynı ay içindeki hafta sonunu kısaltır", () => {
    expect(haftaSonuBicimle(tarihCozumle("2026-10-17")!)).toBe(
      "17–18 Ekim 2026",
    );
  });

  it("ay sınırındaki hafta sonunu kısaltmadan yazar", () => {
    // "31–1 Kasım" yanlış okunurdu.
    expect(haftaSonuBicimle(tarihCozumle("2026-10-31")!)).toBe(
      "31 Ekim 2026 – 1 Kasım 2026",
    );
  });
});

describe("grupZamani", () => {
  it("§2.3'teki dört zaman dilimini üretir", () => {
    expect(grupZamani("CUMARTESI", "OGLEDEN_ONCE")).toBe(
      "Cumartesi öğleden önce",
    );
    expect(grupZamani("PAZAR", "OGLEDEN_SONRA")).toBe("Pazar öğleden sonra");
  });
});
