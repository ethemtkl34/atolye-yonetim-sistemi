import { describe, expect, it } from "vitest";
import {
  gunEkle,
  gunundenGun,
  grupTarihi,
  grupZamani,
  haftaBasi,
  haftaBicimle,
  tarihBicimle,
  tarihCozumle,
  tarihGunleBicimle,
  tarihMetni,
  yasBicimle,
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

describe("gunundenGun", () => {
  it("haftanın yedi gününü de ayırt eder", () => {
    // 3 Ağustos 2026 pazartesi.
    expect(gunundenGun(new Date(Date.UTC(2026, 7, 3)))).toBe("PAZARTESI");
    expect(gunundenGun(new Date(Date.UTC(2026, 7, 5)))).toBe("CARSAMBA");
    expect(gunundenGun(new Date(Date.UTC(2026, 7, 1)))).toBe("CUMARTESI");
    expect(gunundenGun(new Date(Date.UTC(2026, 7, 2)))).toBe("PAZAR");
  });
});

describe("haftaBasi", () => {
  // 2026-10-12 pazartesi, 2026-10-18 pazar.
  it("pazartesiyi olduğu gibi bırakır", () => {
    expect(tarihMetni(haftaBasi(tarihCozumle("2026-10-12")!))).toBe(
      "2026-10-12",
    );
  });

  it("haftanın her gününü aynı çapaya çeker", () => {
    // Koordinatör takvimden hangi günü seçerse seçsin aynı hafta kaydedilmeli.
    for (const gun of ["2026-10-13", "2026-10-17", "2026-10-18"]) {
      expect(tarihMetni(haftaBasi(tarihCozumle(gun)!))).toBe("2026-10-12");
    }
  });

  it("pazarı bir sonraki haftaya taşımaz", () => {
    // ISO haftası pazar günü biter; pazartesiye yuvarlansaydı pazar grupları
    // bir hafta ileri kayardı.
    expect(tarihMetni(haftaBasi(tarihCozumle("2026-10-18")!))).toBe(
      "2026-10-12",
    );
  });
});

describe("grupTarihi", () => {
  const pazartesi = tarihCozumle("2026-10-12")!;

  it("çapa gününü olduğu gibi verir", () => {
    expect(tarihMetni(grupTarihi(pazartesi, "PAZARTESI"))).toBe("2026-10-12");
  });

  it("hafta içi günleri çapadan sayar", () => {
    expect(tarihMetni(grupTarihi(pazartesi, "CARSAMBA"))).toBe("2026-10-14");
    expect(tarihMetni(grupTarihi(pazartesi, "CUMA"))).toBe("2026-10-16");
  });

  it("hafta sonu günleri eski tarihlere denk gelir", () => {
    // Çapa cumartesiden pazartesiye taşındı ama gerçek toplanma tarihi
    // değişmedi: eskiden çapa 17 Ekim'di, cumartesi grubu yine 17 Ekim'de.
    expect(tarihMetni(grupTarihi(pazartesi, "CUMARTESI"))).toBe("2026-10-17");
    expect(tarihMetni(grupTarihi(pazartesi, "PAZAR"))).toBe("2026-10-18");
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

describe("haftaBicimle", () => {
  it("hafta sonunu aynı ay içindeyse kısaltır", () => {
    // 2026-10-12 pazartesi; hafta sonu 17–18 Ekim.
    expect(haftaBicimle(tarihCozumle("2026-10-12")!, "HAFTA_SONU")).toBe(
      "17–18 Ekim 2026",
    );
  });

  it("hafta içi aralığını pazartesi–cuma olarak yazar", () => {
    expect(haftaBicimle(tarihCozumle("2026-10-12")!, "HAFTA_ICI")).toBe(
      "12–16 Ekim 2026",
    );
  });

  it("ay sınırındaki aralığı kısaltmadan yazar", () => {
    // 2026-10-26 pazartesi; hafta sonu 31 Ekim – 1 Kasım.
    // "31–1 Kasım" yanlış okunurdu.
    expect(haftaBicimle(tarihCozumle("2026-10-26")!, "HAFTA_SONU")).toBe(
      "31 Ekim 2026 – 1 Kasım 2026",
    );
  });
});

describe("grupZamani", () => {
  it("tek günlü grubu eskisi gibi yazar", () => {
    expect(grupZamani(["CUMARTESI"], "OGLEDEN_ONCE")).toBe(
      "Cumartesi öğleden önce",
    );
    expect(grupZamani(["PAZAR"], "OGLEDEN_SONRA")).toBe("Pazar öğleden sonra");
  });

  it("çok günlü grubu takvim sırasına dizer", () => {
    // Koordinatör kutuları hangi sırayla işaretlerse işaretlesin.
    expect(grupZamani(["CARSAMBA", "PAZARTESI"], "OGLEDEN_ONCE")).toBe(
      "Pazartesi, Çarşamba öğleden önce",
    );
  });
});

describe("yasBicimle", () => {
  const yas = (dogum: string, referans: string) =>
    yasBicimle(tarihCozumle(dogum)!, tarihCozumle(referans)!);

  it("yıl, ay ve günü birlikte yazar", () => {
    expect(yas("2018-03-14", "2026-08-11")).toBe("8 yaş 4 ay 28 gün");
  });

  it("doğum günündeyken ay ve günü sıfırlar", () => {
    expect(yas("2018-08-11", "2026-08-11")).toBe("8 yaş 0 ay 0 gün");
  });

  it("gün eksiye düşünce önceki aydan ödünç alır", () => {
    // Referans ayından önceki ay (Şubat 2026, 28 gün) kadar ödünç alınır.
    expect(yas("2020-01-31", "2026-03-01")).toBe("6 yaş 1 ay 1 gün");
  });

  it("ay eksiye düşünce yıldan ödünç alır", () => {
    expect(yas("2019-11-20", "2026-03-05")).toBe("6 yaş 3 ay 13 gün");
  });

  it("bir yaşından küçükte yaş parçasını yazmaz", () => {
    expect(yas("2026-04-05", "2026-08-11")).toBe("4 ay 6 gün");
  });
});
