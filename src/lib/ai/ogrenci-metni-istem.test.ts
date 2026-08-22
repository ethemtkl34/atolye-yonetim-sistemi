import { describe, expect, it } from "vitest";
import {
  gozlemYeterliMi,
  ogrenciMetniCozumle,
  ogrenciMetniGirdisiYaz,
  type OgrenciMetniGirdisi,
} from "./ogrenci-metni-istem";

const TEMEL: OgrenciMetniGirdisi = {
  ilkAd: "Ramazan",
  programAdi: "2026 Sonbahar Dönemi",
  haftaSayisi: 10,
  atolyeSayisi: 5,
  programAtolyeleri: ["Bilim Atölyesi", "Robotik ve Kodlama Atölyesi"],
  katilim: [{ atolyeAdi: "Bilim Atölyesi", katildi: 9, kapsam: 10 }],
  atolyeler: [{ ad: "Bilim Atölyesi", ilgi: "Yüksek", basari: "Ortalama" }],
  gelisimAlanlari: [{ ad: "Duygusal Gelişim Alanları", kademe: "Yüksek" }],
  gozlemler: [],
  genelGozlem: null,
  beceriler: [{ ad: "Akıl Yürütme", tanim: "Bilgiyi kullanarak çıkarım yapma." }],
  urunler: [],
};

describe("gozlemYeterliMi", () => {
  it("gözlem notu olmadan bölüm üretilmez", () => {
    expect(gozlemYeterliMi(TEMEL)).toBe(false);
  });

  it("tek kelimelik notlar yetmez", () => {
    expect(
      gozlemYeterliMi({
        ...TEMEL,
        gozlemler: [
          { atolyeAdi: "Bilim", hafta: 1, konu: null, not: "iyiydi" },
          { atolyeAdi: "Bilim", hafta: 2, konu: null, not: "katıldı" },
        ],
      }),
    ).toBe(false);
  });

  it("yeterli uzunlukta gözlem varsa üretilir", () => {
    expect(
      gozlemYeterliMi({
        ...TEMEL,
        genelGozlem:
          "Ramazan gruba sonradan dahil olmasına rağmen kısa sürede uyum sağladı. Etkinliklerde söz alarak düşüncelerini paylaşmaya istekliydi ve arkadaşlarıyla iş birliğine açıktı.",
      }),
    ).toBe(true);
  });
});

describe("ogrenciMetniGirdisiYaz", () => {
  it("gözlem notlarını en sona koyar — metnin tek somut kaynağı o", () => {
    const metin = ogrenciMetniGirdisiYaz({
      ...TEMEL,
      gozlemler: [
        {
          atolyeAdi: "Astronomi Atölyesi",
          hafta: 10,
          konu: "Yapay Uydu",
          not: "Uydular ne yapar sorusuna internet çektirir dedi.",
        },
      ],
    });

    expect(metin.indexOf("GÖZLEM NOTLARI")).toBeGreaterThan(
      metin.indexOf("ATÖLYE KADEMELERİ"),
    );
    expect(metin).toContain("[Astronomi Atölyesi · 10. hafta · Yapay Uydu]");
  });

  it("ürün listesi boşken modele ad vermemesi söylenir", () => {
    const metin = ogrenciMetniGirdisiYaz(TEMEL);
    expect(metin).toContain("uygun ürün yok — ürün adı verme");
  });

  it("ölçülemeyen kademe açıkça yazılır, boş bırakılmaz", () => {
    const metin = ogrenciMetniGirdisiYaz({
      ...TEMEL,
      gelisimAlanlari: [{ ad: "Sosyal Gelişim Alanları", kademe: null }],
    });
    expect(metin).toContain("Sosyal Gelişim Alanları: değerlendirilmedi");
  });
});

describe("ogrenciMetniCozumle", () => {
  it("iç etiket sızıntılarını metinden temizler", () => {
    // İstemdeki seçim gerekçeleri eski üretimlerde metne kopyalanabiliyordu;
    // "(ATOLYE_BAGI)" gibi kod veliye giden cümlede kalmamalı.
    const ham = JSON.stringify({
      giris: "Giriş.",
      profil: "Profil.",
      bloklar: [],
      sonuc: "Sonuç.",
      oneriler:
        "GO Ahşap Zeka Oyunu (ATOLYE_BAGI) ile sıra bekleme çalışılabilir. Kod kartları (DESTEKLENECEK_ALAN) da kullanılabilir.",
    });
    const sonuc = ogrenciMetniCozumle(ham);
    expect(sonuc?.oneriler).toBe(
      "GO Ahşap Zeka Oyunu ile sıra bekleme çalışılabilir. Kod kartları da kullanılabilir.",
    );
  });

  const gecerli = JSON.stringify({
    giris: "Dönem tanıtımı.",
    profil: "Öğrenci profili.",
    bloklar: [
      { beceriAdi: "Akıl Yürütme", etkinlik: "Etkinlik.", gozlem: "Gözlem." },
    ],
    sonuc: "Kapanış.",
    oneriler: "Ev önerileri.",
  });

  it("düz JSON çözümlenir", () => {
    expect(ogrenciMetniCozumle(gecerli)?.giris).toBe("Dönem tanıtımı.");
  });

  it("kod çiti içindeki JSON da çözümlenir", () => {
    const cevap = "```json\n" + gecerli + "\n```";
    expect(ogrenciMetniCozumle(cevap)?.bloklar).toHaveLength(1);
  });

  it("zorunlu bölüm eksikse null döner — yarım rapor basılmaz", () => {
    const eksik = JSON.stringify({ giris: "a", profil: "b", sonuc: "c" });
    expect(ogrenciMetniCozumle(eksik)).toBeNull();
  });

  it("bozuk JSON null döner", () => {
    expect(ogrenciMetniCozumle("bir şeyler yazdım ama JSON değil")).toBeNull();
  });

  it("gözlemi boş blok atılır", () => {
    const bosBlok = JSON.stringify({
      giris: "a",
      profil: "b",
      sonuc: "c",
      oneriler: "d",
      bloklar: [
        { beceriAdi: "Akıl Yürütme", etkinlik: "x", gozlem: "" },
        { beceriAdi: "İnce Motor", etkinlik: "y", gozlem: "dolu" },
      ],
    });
    const sonuc = ogrenciMetniCozumle(bosBlok);
    expect(sonuc?.bloklar).toHaveLength(1);
    expect(sonuc?.bloklar[0].beceriAdi).toBe("İnce Motor");
  });
});
