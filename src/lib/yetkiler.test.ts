import { describe, expect, it } from "vitest";
import {
  MODULLER,
  YETKI_MATRISI,
  etkinYetki,
  yetkiYeter,
  yetkileriHesapla,
} from "./yetkiler";

describe("YETKI_MATRISI değişmezleri", () => {
  it("psikolog ve koordinatör birebir aynı yetkileri taşır", () => {
    // Matriste iki ayrı unvan, tek satır. Satırlar ayrışırsa bu bilinçli bir
    // ürün kararı olmalı, sessiz bir düzenleme kazası değil.
    expect(YETKI_MATRISI.ATOLYE_PSIKOLOGU).toEqual(YETKI_MATRISI.KOORDINATOR);
  });

  it("koordinatör zeka testlerinde yalnızca görüntüler", () => {
    // Sonuç belgesi yükleme/silme Test Uygulayıcısı unvanının işi.
    expect(YETKI_MATRISI.KOORDINATOR.zekaTestleri).toBe("GORUNTULE");
  });

  it("test uygulayıcısının tek yetkisi zeka testleri", () => {
    for (const modul of MODULLER) {
      expect(YETKI_MATRISI.TEST_UYGULAYICISI[modul]).toBe(
        modul === "zekaTestleri" ? "TAM" : "YOK",
      );
    }
  });

  it("danışma görevlisi görüşmeleri hiç göremez", () => {
    // Sağlık mahremiyeti kuralı: stajyerdeki gizliliğin aynısı.
    expect(YETKI_MATRISI.DANISMA_GOREVLISI.danismanlik).toBe("YOK");
  });

  it("danışma görevlisi zeka testlerinde yalnızca listeyi görür", () => {
    expect(YETKI_MATRISI.DANISMA_GOREVLISI.zekaTestleri).toBe("LISTE");
  });

  it("stajyerin koordinatör paneli modülleri tamamen kapalı", () => {
    for (const modul of MODULLER) {
      expect(YETKI_MATRISI.STAJYER[modul]).toBe("YOK");
    }
  });

  it("kullanıcı yönetimi yalnızca yönetici satırında açık", () => {
    expect(YETKI_MATRISI.ADMIN.kullanicilar).toBe("TAM");
    expect(YETKI_MATRISI.KOORDINATOR.kullanicilar).toBe("YOK");
    expect(YETKI_MATRISI.DANISMA_GOREVLISI.kullanicilar).toBe("YOK");
  });
});

describe("etkinYetki", () => {
  it("rol birleşiminde en yüksek seviye kazanır", () => {
    // Psikolog + Test Uygulayıcısı: zeka testleri GORUNTULE → TAM'a yükselir.
    expect(
      etkinYetki(["ATOLYE_PSIKOLOGU", "TEST_UYGULAYICISI"], "zekaTestleri"),
    ).toBe("TAM");
    // Diğer modüller psikolog satırından gelir, test uygulayıcısı düşürmez.
    expect(
      etkinYetki(["ATOLYE_PSIKOLOGU", "TEST_UYGULAYICISI"], "donemler"),
    ).toBe("TAM");
  });

  it("danışma görevlisi + test uygulayıcısı birleşimi belge yükleyebilir", () => {
    expect(
      etkinYetki(["DANISMA_GOREVLISI", "TEST_UYGULAYICISI"], "zekaTestleri"),
    ).toBe("TAM");
  });

  it("boş rol listesi her modülde YOK döner", () => {
    expect(etkinYetki([], "donemler")).toBe("YOK");
  });
});

describe("yetkiYeter", () => {
  it("seviyeler sıralı: LISTE, GORUNTULE'ye yetmez", () => {
    // Danışma görevlisi listeyi görür ama belge açma (GORUNTULE) sınırında
    // durur — indirme rotası tam bu kontrole dayanıyor.
    expect(yetkiYeter(["DANISMA_GOREVLISI"], "zekaTestleri", "LISTE")).toBe(
      true,
    );
    expect(yetkiYeter(["DANISMA_GOREVLISI"], "zekaTestleri", "GORUNTULE")).toBe(
      false,
    );
  });

  it("GORUNTULE, LISTE gereksinimini karşılar", () => {
    // Koordinatör liste sayfasına da girebilir; alt seviye üstü kapsar.
    expect(yetkiYeter(["KOORDINATOR"], "zekaTestleri", "LISTE")).toBe(true);
  });

  it("TAM her gereksinimi karşılar", () => {
    expect(yetkiYeter(["ADMIN"], "kullanicilar", "TAM")).toBe(true);
  });
});

describe("yetkileriHesapla", () => {
  it("bütün modülleri tek seferde, birleşimle hesaplar", () => {
    const yetkiler = yetkileriHesapla(["DANISMA_GOREVLISI"]);
    expect(yetkiler.ogrenciler).toBe("TAM");
    expect(yetkiler.kayitlar).toBe("TAM");
    expect(yetkiler.donemler).toBe("GORUNTULE");
    expect(yetkiler.danismanlik).toBe("YOK");
    expect(yetkiler.puanlamalar).toBe("YOK");
    expect(Object.keys(yetkiler)).toHaveLength(MODULLER.length);
  });
});
