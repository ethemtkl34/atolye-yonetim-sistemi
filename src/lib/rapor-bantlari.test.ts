import { describe, expect, it } from "vitest";
import {
  asimetriBul,
  atolyeBandi,
  gelisimBandi,
  gelisimCumlesi,
  KADEMELER,
} from "./rapor-bantlari";

describe("gelisimBandi — gruba göre kıyas", () => {
  it("grubun belirgin üstündeki öğrenci yüksek kademededir", () => {
    expect(gelisimBandi(4.64, 3.92)?.kademe).toBe("YUKSEK");
  });

  it("gruba yakın öğrenci ortalama kademededir", () => {
    expect(gelisimBandi(4.08, 4.0)?.kademe).toBe("ORTALAMA");
  });

  it("grubun belirgin altındaki öğrenci düşük kademededir", () => {
    expect(gelisimBandi(3.2, 4.0)?.kademe).toBe("DUSUK");
  });

  it("eşiğin tam üstü yüksek, tam altı ortalamadır", () => {
    expect(gelisimBandi(4.25, 4.0)?.kademe).toBe("YUKSEK");
    expect(gelisimBandi(4.24, 4.0)?.kademe).toBe("ORTALAMA");
  });

  it("mutlak puan yüksek olsa da grup daha yüksekse kademe düşer", () => {
    // §11.3 — bu bölümün ölçütü kıyastır; 4,4 iyi bir puandır ama
    // grubu 4,8 olan bir öğrenci için "yaşıtlarının üzerinde" denemez.
    expect(gelisimBandi(4.4, 4.8)?.kademe).toBe("DUSUK");
  });

  it("grup ortalaması yoksa mutlak eşiklere düşer", () => {
    expect(gelisimBandi(4.5, null)?.kademe).toBe("YUKSEK");
    expect(gelisimBandi(2.0, null)?.kademe).toBe("DUSUK");
  });

  it("öğrenci ortalaması yoksa kademe üretilmez", () => {
    expect(gelisimBandi(null, 4.0)).toBeNull();
  });
});

describe("atolyeBandi — mutlak, kıyassız", () => {
  it("örnek rapordaki ilgi puanları yüksek kademeye düşer", () => {
    for (const puan of [4.72, 4.89, 4.33, 4.86, 4.71, 4.75, 4.79]) {
      expect(atolyeBandi(puan)?.kademe).toBe("YUKSEK");
    }
  });

  it("eşik sınırları kapsayıcıdır", () => {
    expect(atolyeBandi(4.0)?.kademe).toBe("YUKSEK");
    expect(atolyeBandi(3.99)?.kademe).toBe("ORTALAMA");
    expect(atolyeBandi(3.0)?.kademe).toBe("ORTALAMA");
    expect(atolyeBandi(2.99)?.kademe).toBe("DUSUK");
  });

  it("puanlanmamış atölye kademe almaz", () => {
    expect(atolyeBandi(null)).toBeNull();
  });
});

describe("kademe göstergesi", () => {
  it("renk tek kanal değildir — dolu segment sayısı kademeyle birlikte artar", () => {
    // Renk körlüğü ve gri baskı için: renk okunamasa bile kademe
    // segment sayısından çıkmalı.
    expect(KADEMELER.YUKSEK.dolu).toBe(3);
    expect(KADEMELER.ORTALAMA.dolu).toBe(2);
    expect(KADEMELER.DUSUK.dolu).toBe(1);
  });

  it("her kademenin ayrı rengi ve zemini vardır", () => {
    const renkler = Object.values(KADEMELER).map((k) => k.renk);
    expect(new Set(renkler).size).toBe(3);
  });
});

describe("gelisimCumlesi", () => {
  const kazanim = "duyguları tanımak, ifade etmek ve yönetmek";

  it("kıyaslı cümlede yaşıt karşılaştırması geçer", () => {
    const cumle = gelisimCumlesi(
      KADEMELER.YUKSEK,
      "duygusal beceriler",
      kazanim,
      true,
    );
    expect(cumle).toContain("yaşıtlarının üzerinde");
  });

  it("kıyas yapılamadığında yaşıt karşılaştırması yapılmaz", () => {
    const cumle = gelisimCumlesi(
      KADEMELER.YUKSEK,
      "duygusal beceriler",
      kazanim,
      false,
    );
    expect(cumle).not.toContain("yaşıt");
  });

  it("hiçbir kademede olumsuz yargı dili kullanılmaz", () => {
    const yasakli = ["altında", "geride", "yetersiz", "başarısız", "zayıf"];

    for (const bant of Object.values(KADEMELER)) {
      for (const kiyasli of [true, false]) {
        const cumle = gelisimCumlesi(bant, "sosyal beceriler", kazanim, kiyasli);
        for (const kelime of yasakli) {
          expect(cumle.toLocaleLowerCase("tr-TR")).not.toContain(kelime);
        }
      }
    }
  });

  it("en alt kademe bile gelişimin sürdüğünü söyler ve desteğe işaret eder", () => {
    const cumle = gelisimCumlesi(
      KADEMELER.DUSUK,
      "bilişsel beceriler",
      kazanim,
      true,
    );
    expect(cumle).toContain("gelişimi");
    expect(cumle).toContain("destek");
  });
});

describe("asimetriBul", () => {
  it("ilgi ile başarı yakınsa bulgu üretilmez", () => {
    // Örnek rapordaki gerçek değerler: farklar 0,05–0,33 arası.
    const bulgular = asimetriBul([
      { atolyeAdi: "Bilim", ilgi: 4.72, basari: 4.67 },
      { atolyeAdi: "Robotik", ilgi: 4.89, basari: 4.92 },
      { atolyeAdi: "Astronomi", ilgi: 4.33, basari: 4.32 },
      { atolyeAdi: "Zekâ Oyunları", ilgi: 4.75, basari: 4.42 },
    ]);
    expect(bulgular).toHaveLength(0);
  });

  it("ilgi belirgin yüksekse atölyeyi ismen bildirir", () => {
    const bulgular = asimetriBul([
      { atolyeAdi: "Astronomi Atölyesi", ilgi: 4.8, basari: 3.6 },
    ]);
    expect(bulgular).toHaveLength(1);
    expect(bulgular[0].yon).toBe("ILGI_YUKSEK");
    expect(bulgular[0].cumle).toContain("Astronomi Atölyesi");
  });

  it("başarı belirgin yüksekse ilgi sürekliliğine işaret eder", () => {
    const bulgular = asimetriBul([
      { atolyeAdi: "Bilim Atölyesi", ilgi: 3.2, basari: 4.6 },
    ]);
    expect(bulgular[0].yon).toBe("BASARI_YUKSEK");
    expect(bulgular[0].cumle).toContain("ilgi kaybını");
  });

  it("eksik ölçüm karşılaştırmaya girmez", () => {
    const bulgular = asimetriBul([
      { atolyeAdi: "Gastronomi", ilgi: 4.9, basari: null },
      { atolyeAdi: "Masal", ilgi: null, basari: 2.0 },
    ]);
    expect(bulgular).toHaveLength(0);
  });
});

describe("asimetriBul birleştirme", () => {
  it("aynı yönde 3+ atölyeyi tek cümlede birleştirir", () => {
    const bulgular = asimetriBul([
      { atolyeAdi: "Bilim Atölyesi", ilgi: 4.2, basari: 3.2 },
      { atolyeAdi: "Robotik Atölyesi", ilgi: 4.3, basari: 3.1 },
      { atolyeAdi: "Zekâ Atölyesi", ilgi: 4.5, basari: 3.2 },
    ]);
    expect(bulgular).toHaveLength(1);
    expect(bulgular[0].yon).toBe("ILGI_YUKSEK");
    expect(bulgular[0].cumle).toContain("Bilim, Robotik ve Zekâ");
    expect(bulgular[0].cumle).toContain("tümünde ilgisi belirgin biçimde yüksek");
  });

  it("1-2 atölyelik bulguları ayrı bırakır", () => {
    const bulgular = asimetriBul([
      { atolyeAdi: "Bilim Atölyesi", ilgi: 4.2, basari: 3.2 },
      { atolyeAdi: "Robotik Atölyesi", ilgi: 3.0, basari: 4.0 },
    ]);
    expect(bulgular).toHaveLength(2);
    expect(bulgular[0].atolyeAdi).toBe("Bilim Atölyesi");
  });
});
