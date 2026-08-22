import { describe, expect, it } from "vitest";
import {
  alanAnahtari,
  alandanCoz,
  duzenlemeIsle,
  duzenlemeSil,
  duzenlemeleriTasi,
  metniOku,
  metniYaz,
  type DuzenlenebilirAlan,
} from "./rapor-duzenleme";
import type { RaporGovdesiV2 } from "./rapor-govdesi";

const ZAMAN = new Date("2026-08-22T10:00:00.000Z");

function govde(ek: Partial<RaporGovdesiV2> = {}): RaporGovdesiV2 {
  return {
    surum: 2,
    ogrenci: { adSoyad: "Nehir Balcı", ilkAd: "Nehir", sinif: "3" },
    egitimYili: "2026-2027",
    kapsam: [],
    atolyeIcerikleri: [{ atolyeAdi: "Bilim Atölyesi", metin: "Üretilen içerik." }],
    gelisimAlanlari: [
      {
        ad: "Duygusal Gelişim Alanları",
        bant: null,
        kazanimlar: [],
        cumle: "Üretilen cümle.",
        degisim: { yon: "ILERLEME", fark: 0.6, cumle: "Üretilen ilerleme." },
      },
    ],
    atolyeKademeleri: [
      {
        atolyeAdi: "Bilim Atölyesi",
        ilgi: null,
        basari: null,
        katildigiOturumSayisi: 8,
        katilmadigiOturumSayisi: 2,
        metin: "Üretilen atölye metni.",
      },
    ],
    asimetriler: [],
    gozlem: {
      giris: "Üretilen giriş.",
      profil: "Üretilen profil.",
      bloklar: [{ beceriAdi: "Dikkat", tanim: "", etkinlik: null, gozlem: "Üretilen gözlem." }],
      sonuc: "Üretilen sonuç.",
      oneriler: "Üretilen öneriler.",
      urunler: [],
    },
    metinKaynagi: "ai",
    ...ek,
  };
}

const ALANLAR: DuzenlenebilirAlan[] = [
  { tur: "atolyeIcerik", atolyeAdi: "Bilim Atölyesi" },
  { tur: "atolyeMetni", atolyeAdi: "Bilim Atölyesi" },
  { tur: "gelisimCumle", alanAdi: "Duygusal Gelişim Alanları" },
  { tur: "gelisimDegisim", alanAdi: "Duygusal Gelişim Alanları" },
  { tur: "gozlem", bolum: "giris" },
  { tur: "gozlemBlok", beceriAdi: "Dikkat" },
];

describe("alanAnahtari / alandanCoz", () => {
  it("her alan anahtara çevrilip geri okunabilir", () => {
    for (const alan of ALANLAR) {
      expect(alandanCoz(alanAnahtari(alan))).toEqual(alan);
    }
  });

  it("tanınmayan anahtarlar çözülmez", () => {
    expect(alandanCoz("uydurma:bir sey")).toBeNull();
    expect(alandanCoz("gozlem:olmayanBolum")).toBeNull();
    expect(alandanCoz("anahtarsiz")).toBeNull();
    expect(alandanCoz("atolyeIcerik:")).toBeNull();
  });
});

describe("metniOku / metniYaz", () => {
  it("her alan okunup yazılabilir", () => {
    const g = govde();
    for (const alan of ALANLAR) {
      expect(metniOku(g, alan)).toContain("Üretilen");
      expect(metniYaz(g, alan, "Elle yazıldı.")).toBe(true);
      expect(metniOku(g, alan)).toBe("Elle yazıldı.");
    }
  });

  it("hedef yoksa yazma başarısız olur ve gövde değişmez", () => {
    const g = govde({ gozlem: null });
    expect(metniYaz(g, { tur: "gozlem", bolum: "giris" }, "x")).toBe(false);
    expect(
      metniYaz(g, { tur: "atolyeIcerik", atolyeAdi: "Yok Atölyesi" }, "x"),
    ).toBe(false);
    expect(g.atolyeIcerikleri[0].metin).toBe("Üretilen içerik.");
  });

  it("ilerleme yorumunun yönü düzenlemeyle değişmez", () => {
    const g = govde();
    metniYaz(g, { tur: "gelisimDegisim", alanAdi: "Duygusal Gelişim Alanları" }, "Yumuşatıldı.");
    expect(g.gelisimAlanlari[0].degisim?.yon).toBe("ILERLEME");
    expect(g.gelisimAlanlari[0].degisim?.fark).toBe(0.6);
  });
});

describe("düzenleme defteri", () => {
  const alan: DuzenlenebilirAlan = { tur: "gozlem", bolum: "giris" };

  it("ilk düzenlemede özgün metni saklar", () => {
    const g = govde();
    duzenlemeIsle(g, alan, "Üretilen giriş.", "Ayşe", ZAMAN);
    expect(g.duzenlemeler).toHaveLength(1);
    expect(g.duzenlemeler![0].ozgunMetin).toBe("Üretilen giriş.");
    expect(g.duzenlemeler![0].kisi).toBe("Ayşe");
  });

  it("ikinci düzenleme özgün metni EZMEZ", () => {
    const g = govde();
    duzenlemeIsle(g, alan, "Üretilen giriş.", "Ayşe", ZAMAN);
    duzenlemeIsle(g, alan, "İlk taslak.", "Mehmet", new Date("2026-08-23"));
    expect(g.duzenlemeler).toHaveLength(1);
    // "Özgüne dön" üretimin yazdığına dönmeli, ara taslağa değil.
    expect(g.duzenlemeler![0].ozgunMetin).toBe("Üretilen giriş.");
    expect(g.duzenlemeler![0].kisi).toBe("Mehmet");
  });

  it("geri alma kaydı defterden düşürür", () => {
    const g = govde();
    duzenlemeIsle(g, alan, "Üretilen giriş.", "Ayşe", ZAMAN);
    duzenlemeSil(g, alan);
    expect(g.duzenlemeler).toHaveLength(0);
  });
});

describe("duzenlemeleriTasi", () => {
  it("elle yazılan metinleri yeni gövdeye taşır ve defteri yeniler", () => {
    const eski = govde();
    metniYaz(eski, { tur: "gozlem", bolum: "giris" }, "Elle yazılmış giriş.");
    duzenlemeIsle(eski, { tur: "gozlem", bolum: "giris" }, "Üretilen giriş.", "Ayşe", ZAMAN);

    const yeni = govde();
    yeni.gozlem!.giris = "Yeni üretilen giriş.";

    const sonuc = duzenlemeleriTasi(eski, yeni, ZAMAN);

    expect(sonuc.tasinan).toHaveLength(1);
    expect(sonuc.tasinamayan).toHaveLength(0);
    expect(yeni.gozlem!.giris).toBe("Elle yazılmış giriş.");
    // Yeni defterdeki özgün metin YENİ üretimin metni: "özgüne dön" artık
    // eski üretime değil, bu raporun kendi metnine döner.
    expect(yeni.duzenlemeler![0].ozgunMetin).toBe("Yeni üretilen giriş.");
  });

  it("karşılığı üretilmemiş düzenlemeyi taşımaz ve ismen bildirir", () => {
    const eski = govde();
    metniYaz(eski, { tur: "gozlem", bolum: "giris" }, "Elle yazılmış giriş.");
    duzenlemeIsle(eski, { tur: "gozlem", bolum: "giris" }, "Üretilen giriş.", "Ayşe", ZAMAN);

    const yeni = govde({ gozlem: null });
    const sonuc = duzenlemeleriTasi(eski, yeni, ZAMAN);

    expect(sonuc.tasinan).toHaveLength(0);
    expect(sonuc.tasinamayan).toEqual(["Gözlem raporu · giriş"]);
  });

  it("defteri olmayan eski rapordan taşınacak bir şey yoktur", () => {
    const sonuc = duzenlemeleriTasi(govde(), govde(), ZAMAN);
    expect(sonuc.tasinan).toHaveLength(0);
    expect(sonuc.tasinamayan).toHaveLength(0);
  });
});
