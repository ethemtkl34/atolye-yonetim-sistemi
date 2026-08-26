import { describe, expect, it } from "vitest";
import { type MukerrerBaglami, mukerrerKarari } from "./mukerrer";

function baglam(ek: Partial<MukerrerBaglami> = {}): MukerrerBaglami {
  return {
    kanal: "api",
    zorla: false,
    telefonVar: true,
    acikAday: null,
    veliEslesmesi: null,
    ...ek,
  };
}

const ACIK_ADAY = { id: "aday-1", ad: "Ayşe Yılmaz", kacDakikaOnce: 60 };
const VELI = { ogrenciId: "ogr-1", ogrenciAdi: "Kerem Aksoy" };

describe("mukerrerKarari — telefonsuz", () => {
  it("karşılaştıracak anahtar yoksa aday açılır", () => {
    // Meta formu telefon sorusu taşımayabilir; eşleşme aranamaz.
    expect(mukerrerKarari(baglam({ telefonVar: false })).tur).toBe("olustur");
  });

  it("telefonsuzsa açık aday varlığı bile kararı değiştirmez", () => {
    const karar = mukerrerKarari(
      baglam({ telefonVar: false, acikAday: ACIK_ADAY }),
    );
    expect(karar.tur).toBe("olustur");
  });
});

describe("mukerrerKarari — API girişi", () => {
  it("açık aday varsa yeni aday açmaz, mevcuda not düşer", () => {
    const karar = mukerrerKarari(baglam({ acikAday: ACIK_ADAY }));
    expect(karar).toEqual({ tur: "mevcuda-not", adayId: "aday-1" });
  });

  it("birkaç dakika içindeki tekrarı sessizce yutar", () => {
    // Çift tıklama / entegratör yeniden denemesi not bile düşürmemeli.
    const karar = mukerrerKarari(
      baglam({ acikAday: { ...ACIK_ADAY, kacDakikaOnce: 3 } }),
    );
    expect(karar).toEqual({ tur: "sessiz", adayId: "aday-1" });
  });

  it("pencere sınırında sessiz, sınırın ötesinde notlu davranır", () => {
    expect(
      mukerrerKarari(baglam({ acikAday: { ...ACIK_ADAY, kacDakikaOnce: 10 } }))
        .tur,
    ).toBe("sessiz");
    expect(
      mukerrerKarari(
        baglam({ acikAday: { ...ACIK_ADAY, kacDakikaOnce: 10.5 } }),
      ).tur,
    ).toBe("mevcuda-not");
  });

  it("kayıtlı veliyle eşleşmede yeni aday açar ve nota bağlar", () => {
    // Kardeş kaydı meşru bir yeni fırsattır; engellenmemeli.
    const karar = mukerrerKarari(baglam({ veliEslesmesi: VELI }));
    expect(karar.tur).toBe("olustur-notlu");
    if (karar.tur === "olustur-notlu") {
      expect(karar.not).toContain("Kerem Aksoy");
    }
  });

  it("eşleşme yoksa doğrudan açar", () => {
    expect(mukerrerKarari(baglam()).tur).toBe("olustur");
  });
});

describe("mukerrerKarari — elle giriş", () => {
  it("açık adayla eşleşmede engellemez, uyarır", () => {
    const karar = mukerrerKarari(
      baglam({ kanal: "elle", acikAday: ACIK_ADAY }),
    );
    expect(karar).toEqual({
      tur: "uyar",
      benzer: { tur: "aday", id: "aday-1", ad: "Ayşe Yılmaz" },
    });
  });

  it("kayıtlı veliyle eşleşmede öğrenciyi göstererek uyarır", () => {
    const karar = mukerrerKarari(baglam({ kanal: "elle", veliEslesmesi: VELI }));
    expect(karar).toEqual({
      tur: "uyar",
      benzer: { tur: "ogrenci", id: "ogr-1", ad: "Kerem Aksoy" },
    });
  });

  it("onay verildiğinde uyarıyı geçer ve nota bağlar", () => {
    const karar = mukerrerKarari(
      baglam({ kanal: "elle", zorla: true, acikAday: ACIK_ADAY }),
    );
    expect(karar.tur).toBe("olustur-notlu");
    if (karar.tur === "olustur-notlu") {
      expect(karar.not).toContain("Ayşe Yılmaz");
    }
  });

  it("elle girişte sessiz pencere yoktur — danışman kararını görür", () => {
    const karar = mukerrerKarari(
      baglam({ kanal: "elle", acikAday: { ...ACIK_ADAY, kacDakikaOnce: 1 } }),
    );
    expect(karar.tur).toBe("uyar");
  });

  it("açık aday veli eşleşmesinden önce gelir", () => {
    // İkisi birden varsa danışmana daha yakın olanı gösterilir: aday.
    const karar = mukerrerKarari(
      baglam({ kanal: "elle", acikAday: ACIK_ADAY, veliEslesmesi: VELI }),
    );
    expect(karar.tur).toBe("uyar");
    if (karar.tur === "uyar") expect(karar.benzer.tur).toBe("aday");
  });
});
