import { describe, expect, it } from "vitest";
import { ciroCsv, ciroRaporu, randevuCirosu, type CiroGirdisi } from "./ciro";

const girdi = (
  uzmanAdi: string,
  ucretKurus: number,
  ustuneYaz: Partial<CiroGirdisi> = {},
): CiroGirdisi => ({
  uzmanId: uzmanAdi,
  uzmanAdi,
  hizmetId: "h1",
  hizmetAdi: "Oyun Temelli Danışmanlık",
  hizmetGrubu: "DANISMANLIK",
  durum: "GERCEKLESTI",
  ucretKurus,
  indirimKurus: 0,
  ...ustuneYaz,
});

/** Aynı uzmanın `adet` kadar seansı, toplamı `toplamKurus` olacak şekilde. */
const seanslar = (uzmanAdi: string, adet: number, toplamKurus: number) => {
  const taban = Math.floor(toplamKurus / adet);
  const artik = toplamKurus - taban * adet;
  return Array.from({ length: adet }, (_, sira) =>
    girdi(uzmanAdi, sira === 0 ? taban + artik : taban),
  );
};

describe("randevuCirosu", () => {
  it("yalnız gerçekleşen seans ciroya girer", () => {
    expect(randevuCirosu(girdi("A", 320000))).toBe(320000);
    expect(randevuCirosu(girdi("A", 320000, { durum: "PLANLANDI" }))).toBe(0);
    expect(randevuCirosu(girdi("A", 320000, { durum: "GELMEDI" }))).toBe(0);
    expect(randevuCirosu(girdi("A", 320000, { durum: "IPTAL" }))).toBe(0);
  });

  it("indirim düşülür", () => {
    // İndirim gerçekten alınmayan paradır; ciroya yazılamaz.
    expect(randevuCirosu(girdi("A", 320000, { indirimKurus: 50000 }))).toBe(
      270000,
    );
  });

  it("ücretsiz hizmet sıfır ciro üretir", () => {
    expect(randevuCirosu(girdi("A", 0))).toBe(0);
  });
});

describe("ciroRaporu — kurumun 17–23 Ağustos 2026 tablosu", () => {
  /**
   * Belgedeki gerçek hafta. Rapor bu tablonun yerine geçtiği için hem
   * rakamları hem SIRAYI birebir üretmek zorunda: iki tablo yan yana
   * konduğunda karşılaştırılabilmeli.
   */
  const HAFTA: [string, number, number][] = [
    ["BÜŞRA KULABER", 9, 2599000],
    ["MELİSA BEYAZIT", 7, 2192000],
    ["NAZLIHAN İZMİT", 6, 1808000],
    ["FIRAT GÜNEŞ", 5, 3822000],
    ["GÜL AKBULUT", 5, 1504000],
    ["BEYZA ÖZDEMİR", 4, 2886000],
    ["VEFA ABDURRAHİMOVA", 4, 1250000],
    ["GÜLSÜM İNCİ", 3, 884000],
    ["BETÜL ÖZ", 3, 848000],
  ];

  const girdiler = HAFTA.flatMap(([ad, adet, toplam]) =>
    seanslar(ad, adet, toplam),
  );

  it("toplam seans ve ciro belgeyle birebir", () => {
    const rapor = ciroRaporu(girdiler);
    expect(rapor.toplamSeans).toBe(46);
    expect(rapor.toplamCiro).toBe(17793000); // ₺177.930,00
  });

  it("uzman satırları belgeyle birebir", () => {
    const rapor = ciroRaporu(girdiler);
    expect(
      rapor.uzmanlar.map((u) => [u.uzmanAdi, u.seansSayisi, u.ciroKurus]),
    ).toEqual(HAFTA);
  });

  it("eşit seansta ciro yüksek olan üstte", () => {
    // FIRAT GÜNEŞ ve GÜL AKBULUT ikisi de 5 seans; belgede Fırat üstte
    // çünkü cirosu yüksek.
    const rapor = ciroRaporu(girdiler);
    const besliler = rapor.uzmanlar.filter((u) => u.seansSayisi === 5);
    expect(besliler.map((u) => u.uzmanAdi)).toEqual([
      "FIRAT GÜNEŞ",
      "GÜL AKBULUT",
    ]);
  });
});

describe("ciroRaporu — durum ayrımı", () => {
  const girdiler = [
    girdi("Ayşe", 320000),
    girdi("Ayşe", 320000, { durum: "GELMEDI" }),
    girdi("Ayşe", 320000, { durum: "IPTAL" }),
    girdi("Ayşe", 320000, { durum: "PLANLANDI" }),
  ];

  it("ciroya yalnız gerçekleşen girer, diğerleri ayrı sayılır", () => {
    const rapor = ciroRaporu(girdiler);
    expect(rapor.toplamSeans).toBe(1);
    expect(rapor.toplamCiro).toBe(320000);
    expect(rapor.toplamGelmedi).toBe(1);
    expect(rapor.toplamIptal).toBe(1);
    expect(rapor.toplamPlanlanan).toBe(1);
  });

  it("uzman satırında da ayrı ayrı görünür", () => {
    const [uzman] = ciroRaporu(girdiler).uzmanlar;
    expect([uzman.seansSayisi, uzman.gelmedi, uzman.iptal, uzman.planlanan]).toEqual(
      [1, 1, 1, 1],
    );
  });

  it("hiç gerçekleşmeyen uzman listede kalır ama cirosu sıfır", () => {
    // "Bu hafta hiç seans yapmadı" bilgisi de rapor bilgisidir; satırın
    // düşmesi uzmanı raporun dışına atardı.
    const rapor = ciroRaporu([girdi("Boş", 320000, { durum: "IPTAL" })]);
    expect(rapor.uzmanlar).toHaveLength(1);
    expect(rapor.uzmanlar[0].ciroKurus).toBe(0);
  });
});

describe("ciroRaporu — hizmet kırılımı", () => {
  const girdiler = [
    girdi("A", 780000, { hizmetId: "wisc", hizmetAdi: "WISC-IV", hizmetGrubu: "TEST" }),
    girdi("B", 780000, { hizmetId: "wisc", hizmetAdi: "WISC-IV", hizmetGrubu: "TEST" }),
    girdi("A", 320000),
    girdi("A", 320000, { durum: "IPTAL" }),
  ];

  it("hizmet başına seans ve ciro toplar", () => {
    const rapor = ciroRaporu(girdiler);
    expect(rapor.hizmetler.map((h) => [h.hizmetAdi, h.seansSayisi, h.ciroKurus])).toEqual([
      ["WISC-IV", 2, 1560000],
      ["Oyun Temelli Danışmanlık", 1, 320000],
    ]);
  });

  it("iptal edilen hizmet kırılımına HİÇ girmez", () => {
    // "Hangi hizmetten kaç seans yapıldı" sorusunun cevabı iptalleri
    // içeremez; uzman satırındaki iptal sayacı ayrı.
    const rapor = ciroRaporu([girdi("A", 320000, { durum: "IPTAL" })]);
    expect(rapor.hizmetler).toEqual([]);
  });
});

describe("ciroRaporu — sınır durumlar", () => {
  it("boş girdide sıfırlar", () => {
    const rapor = ciroRaporu([]);
    expect([rapor.toplamSeans, rapor.toplamCiro, rapor.uzmanlar.length]).toEqual(
      [0, 0, 0],
    );
  });

  it("indirim ücreti aşarsa ciro eksiye düşmez", () => {
    // Veritabanı CHECK'i bunu zaten engelliyor; hesap yine de savunmalı.
    expect(
      ciroRaporu([girdi("A", 100000, { indirimKurus: 500000 })]).toplamCiro,
    ).toBe(0);
  });
});

describe("ciroCsv", () => {
  const rapor = ciroRaporu([
    girdi("Büşra Kulaber", 780000, { hizmetId: "wisc", hizmetAdi: "WISC-IV", hizmetGrubu: "TEST" }),
    girdi("Büşra Kulaber", 320000, { indirimKurus: 20000 }),
  ]);
  const csv = ciroCsv(rapor, { aralik: "7–13 Eylül 2026", sube: "Ümraniye" });

  it("Excel'in Türkçe yerelde beklediği biçim: BOM + noktalı virgül", () => {
    // BOM olmadan Excel dosyayı Windows-1254 sanıyor ve "Büşra" bozuluyor.
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Uzman;Seans;Ciro (₺)");
  });

  it("tutar ondalık virgülle yazılır", () => {
    // 780000 + (320000 - 20000) = 1.080.000 kuruş = 10800,00 ₺
    expect(csv).toContain("Büşra Kulaber;2;10800,00");
  });

  it("satırlar CRLF ile ayrılır", () => {
    expect(csv).toContain("\r\n");
  });

  it("toplam satırı var", () => {
    expect(csv).toContain("TOPLAM;2;10800,00");
  });

  it("hizmet kırılımı da yazılır", () => {
    expect(csv).toContain("WISC-IV;1;7800,00");
  });

  it("noktalı virgül içeren ad kaçışlanır", () => {
    const kacisli = ciroCsv(
      ciroRaporu([girdi("Öz; Betül", 100000)]),
      { aralik: "x", sube: "y" },
    );
    expect(kacisli).toContain('"Öz; Betül";1;1000,00');
  });
});
