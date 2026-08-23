import { describe, expect, it } from "vitest";
import { gorusmeOnerileriUret, type OneriGirdisi } from "./veli-gorusmesi-onerisi";
import { GOZLEM_ALANLARI } from "./veli-gorusmesi";
import { ZORLANMA_GRUPLARI } from "./veli-gorusmesi-icerik";

const BOS: OneriGirdisi = {
  atolyeBasliklari: [],
  gelisimCevaplari: [],
  gelisimDonemi: null,
  katilim: null,
};

const puan = (sonuc: ReturnType<typeof gorusmeOnerileriUret>, anahtar: string) =>
  sonuc.gozlemPuanlari.find((p) => p.anahtar === anahtar);

describe("gorusmeOnerileriUret — katılım", () => {
  it("yoklama oranını puana çevirir", () => {
    const tam = gorusmeOnerileriUret({ ...BOS, katilim: { kapsam: 10, katildi: 10 } });
    expect(puan(tam, "atolye-katilim")?.deger).toBe(5);

    const yarim = gorusmeOnerileriUret({ ...BOS, katilim: { kapsam: 10, katildi: 5 } });
    expect(puan(yarim, "atolye-katilim")?.deger).toBe(2);

    const az = gorusmeOnerileriUret({ ...BOS, katilim: { kapsam: 10, katildi: 2 } });
    expect(puan(az, "atolye-katilim")?.deger).toBe(1);
  });

  it("yoklama yoksa katılım önerilemez", () => {
    const sonuc = gorusmeOnerileriUret(BOS);
    expect(puan(sonuc, "atolye-katilim")).toBeUndefined();
    expect(sonuc.onerilemeyenler).toContain("atolye-katilim");
  });
});

describe("gorusmeOnerileriUret — gözlem puanları", () => {
  it("atölye başlıklarını ortak sözcük üzerinden eşler", () => {
    const sonuc = gorusmeOnerileriUret({
      ...BOS,
      atolyeBasliklari: [
        { baslik: "Dikkat ve Konsantrasyon", ortalama: 4.4, gozlemSayisi: 8 },
      ],
    });
    expect(puan(sonuc, "dikkat-surdurme")?.deger).toBe(4);
    expect(puan(sonuc, "dikkat-surdurme")?.dayanak).toContain("Dikkat ve Konsantrasyon");
  });

  it("iki kaynağı ağırlıklı birleştirir", () => {
    // 8 ölçüm × 5,0 + 1 gelişim cevabı × 1 → (40+1)/9 ≈ 4,6 → 5
    const sonuc = gorusmeOnerileriUret({
      ...BOS,
      atolyeBasliklari: [
        { baslik: "Dikkat ve Konsantrasyon", ortalama: 5, gozlemSayisi: 8 },
      ],
      gelisimCevaplari: [{ anahtar: "dikkat", deger: 1 }],
      gelisimDonemi: "Dönem sonu",
    });
    const oneri = puan(sonuc, "dikkat-surdurme");
    expect(oneri?.deger).toBe(5);
    expect(oneri?.dayanak).toContain("Dönem sonu gelişim testi");
    expect(oneri?.dayanak).toContain("9 ölçümün");
  });

  it("tek gözlemden öneri üretmez", () => {
    const sonuc = gorusmeOnerileriUret({
      ...BOS,
      gelisimCevaplari: [{ anahtar: "dikkat", deger: 5 }],
    });
    expect(puan(sonuc, "dikkat-surdurme")).toBeUndefined();
    expect(sonuc.onerilemeyenler).toContain("dikkat-surdurme");
  });

  it("her gözlem alanı ya önerilir ya önerilemeyenlere düşer", () => {
    const sonuc = gorusmeOnerileriUret(BOS);
    const kapsanan = [
      ...sonuc.gozlemPuanlari.map((p) => p.anahtar),
      ...sonuc.onerilemeyenler,
    ].sort();
    expect(kapsanan).toEqual(GOZLEM_ALANLARI.map((a) => a.anahtar).sort());
  });
});

describe("gorusmeOnerileriUret — zorlanma alanları", () => {
  it("düşük ortalamayı zorlanma olarak önerir", () => {
    const sonuc = gorusmeOnerileriUret({
      ...BOS,
      gelisimCevaplari: [
        { anahtar: "duygu-duzenleme", deger: 2 },
        { anahtar: "bas-etme", deger: 2 },
      ],
    });
    expect(sonuc.zorlanmalar.map((z) => z.anahtar)).toContain("duyguduzenleme");
  });

  it("eşiğin üstündeki ortalamayı önermez", () => {
    const sonuc = gorusmeOnerileriUret({
      ...BOS,
      gelisimCevaplari: [
        { anahtar: "duygu-duzenleme", deger: 4 },
        { anahtar: "bas-etme", deger: 4 },
      ],
    });
    expect(sonuc.zorlanmalar).toHaveLength(0);
  });

  it("ölçülmeyen alanlar HİÇBİR girdiyle önerilmez", () => {
    // Bütün ölçümler en düşük değerde: motor önerebildiği her şeyi önerir.
    const hepsiDusuk = gorusmeOnerileriUret({
      ...BOS,
      atolyeBasliklari: [
        { baslik: "Dikkat ve Konsantrasyon", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "İş Birliği", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "İletişim Becerileri", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "Öz Güven", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "Duygu Düzenleme", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "Problem Çözme", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "Mantıksal Akıl Yürütme", ortalama: 1, gozlemSayisi: 9 },
        { baslik: "Strateji Kurma", ortalama: 1, gozlemSayisi: 9 },
      ],
      gelisimCevaplari: [
        { anahtar: "dikkat", deger: 1 },
        { anahtar: "bellek", deger: 1 },
        { anahtar: "problem-cozme", deger: 1 },
        { anahtar: "mantiksal-dusunme", deger: 1 },
        { anahtar: "planlama", deger: 1 },
        { anahtar: "dil-gelisimi", deger: 1 },
        { anahtar: "iletisim", deger: 1 },
        { anahtar: "is-birligi", deger: 1 },
        { anahtar: "uzlasma", deger: 1 },
        { anahtar: "sosyal-inisiyatif", deger: 1 },
        { anahtar: "kurallara-uyum", deger: 1 },
        { anahtar: "duygu-duzenleme", deger: 1 },
        { anahtar: "bas-etme", deger: 1 },
        { anahtar: "duygu-tanima", deger: 1 },
        { anahtar: "empati-gelisimi", deger: 1 },
        { anahtar: "oz-yeterlilik", deger: 1 },
        { anahtar: "olumlu-oz-algi", deger: 1 },
        { anahtar: "bagimsizlik", deger: 1 },
      ],
    });

    const onerilen = new Set(hepsiDusuk.zorlanmalar.map((z) => z.anahtar));
    // Klinik gözlem alanı: sistemde bunları ölçen tek bir soru yok.
    for (const yasak of [
      "kaygi",
      "duyuhassasiyeti",
      "mukemmeliyetcilik",
      "icekapaniklik",
      "gorsel",
    ]) {
      expect(onerilen.has(yasak)).toBe(false);
    }
    // Ölçülebilenlerden en az birkaçı gerçekten önerilmiş olmalı; yoksa test
    // "hiç öneri yok" diye de geçerdi.
    expect(onerilen.size).toBeGreaterThanOrEqual(8);
  });

  it("önerilen her anahtar formda gerçekten var", () => {
    const formAnahtarlari = new Set(
      ZORLANMA_GRUPLARI.flatMap((grup) => grup.anahtarlar),
    );
    const sonuc = gorusmeOnerileriUret({
      ...BOS,
      gelisimCevaplari: [
        { anahtar: "dikkat", deger: 1 },
        { anahtar: "bellek", deger: 1 },
        { anahtar: "uzlasma", deger: 1 },
        { anahtar: "sosyal-inisiyatif", deger: 1 },
        { anahtar: "bagimsizlik", deger: 1 },
        { anahtar: "planlama", deger: 1 },
      ],
    });
    expect(sonuc.zorlanmalar.length).toBeGreaterThan(0);
    for (const zorlanma of sonuc.zorlanmalar) {
      expect(formAnahtarlari.has(zorlanma.anahtar)).toBe(true);
    }
  });
});
