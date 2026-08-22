import { describe, expect, it } from "vitest";
import {
  atolyeKademesiCikar,
  atolyeMetniUret,
  gelisimAlanlariCikar,
  iyelikEki,
  oturumEki,
} from "./rapor-govdesi";
import { KADEMELER, VARSAYILAN_ESIKLER } from "./rapor-bantlari";
import type { SoruOrtalamasi } from "./puan-hesaplari";

function soru(
  kategori: string,
  puanToplami: number,
  gozlem: number,
  sortOrder: number,
): SoruOrtalamasi {
  return {
    anahtar: `${kategori}-${sortOrder}`,
    soruMetni: "Soru",
    baslik: "Başlık",
    kategori,
    ortalama: gozlem > 0 ? puanToplami / gozlem : null,
    puanlananOturumSayisi: gozlem,
    puanToplami,
    sortOrder,
  };
}

const ILGI = "İlgi ve Merak Alanları";
const YETENEK = "Yetenek Gelişim Alanları";

describe("atolyeKademesiCikar", () => {
  it("ilgi ve başarıyı doğru kategorilerden çıkarır", () => {
    // Örnek rapordaki Bilim Atölyesi değerleri: ilgi 4,72 · başarı 4,67
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Bilim Atölyesi",
      soruOrtalamalari: [
        soru(ILGI, 47.2, 10, 0),
        soru(YETENEK, 46.7, 10, 1),
      ],
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });

    expect(sonuc.ilgi?.kademe).toBe("YUKSEK");
    expect(sonuc.basari?.kademe).toBe("YUKSEK");
  });

  it("'bilgi' içeren kategori adı 'ilgi' sanılmaz", () => {
    // "Bilgi ve Kavram Gelişimi" alt-dize olarak "ilgi" içerir (b-İLGİ);
    // eski includes eşleşmesi İlgi grafiğini bu sorulardan besliyordu.
    // Kelime eşleşmesiyle: bilgi kategorisi ilgiye sayılmaz, gerçek ilgi
    // kategorisi formda daha sonra da gelse doğru bulunur.
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Bilim Atölyesi",
      soruOrtalamalari: [
        soru("Bilgi ve Kavram Gelişimi", 20, 10, 0), // ort 2,0 — ilgi DEĞİL
        soru(ILGI, 46, 10, 1), // ort 4,6 — gerçek ilgi
        soru(YETENEK, 40, 10, 2),
      ],
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });

    expect(sonuc.ilgiOrtalamasi).toBeCloseTo(4.6);
    expect(sonuc.ilgi?.kademe).toBe("YUKSEK");
  });

  it("ilgi yüksek başarı düşük olduğunda kademeler ayrışır", () => {
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Astronomi Atölyesi",
      soruOrtalamalari: [soru(ILGI, 48, 10, 0), soru(YETENEK, 25, 10, 1)],
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });

    expect(sonuc.ilgi?.kademe).toBe("YUKSEK");
    expect(sonuc.basari?.kademe).toBe("DUSUK");
  });

  it("kategorisi eksik atölyede kademe üretilmez", () => {
    const sonuc = atolyeKademesiCikar({
      atolyeAdi: "Yeni Atölye",
      soruOrtalamalari: [],
      katildigiOturumSayisi: 0,
      katilmadigiOturumSayisi: 2,
    });

    expect(sonuc.ilgi).toBeNull();
    expect(sonuc.basari).toBeNull();
    // Katılmadığı oturumlar yine de raporlanır.
    expect(sonuc.katilmadigiOturumSayisi).toBe(2);
  });
});

describe("gelisimAlanlariCikar", () => {
  const kazanimlar = new Map([
    ["Duygusal Gelişim Alanları", ["Duygu Düzenleme", "Empati Gelişimi"]],
    ["Sosyal Gelişim Alanları", ["Sosyal İnisiyatif"]],
  ]);

  it("grup ortalamasının üstündeki öğrenci için yaşıt kıyası yapar", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.64 }],
      new Map([["Duygusal Gelişim Alanları", 3.92]]),
      kazanimlar,
    );

    expect(sonuc[0].bant?.kademe).toBe("YUKSEK");
    expect(sonuc[0].cumle).toContain("yaşıtlarının üzerinde");
  });

  it("alan adını cümlede okunur biçime çevirir", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.0 }],
      new Map([["Duygusal Gelişim Alanları", 4.0]]),
      kazanimlar,
    );

    expect(sonuc[0].cumle).toContain("duygusal beceriler");
    expect(sonuc[0].cumle).not.toContain("Gelişim Alanları");
  });

  it("kazanımları cümleye tırnak içinde gömer", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.0 }],
      new Map([["Duygusal Gelişim Alanları", 4.0]]),
      kazanimlar,
    );

    expect(sonuc[0].cumle).toContain("duygu düzenleme ve empati gelişimi");
  });

  it("grup ortalaması yoksa yaşıt kıyası yapılmaz", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Sosyal Gelişim Alanları", ortalama: 4.8 }],
      new Map(),
      kazanimlar,
    );

    expect(sonuc[0].bant?.kademe).toBe("YUKSEK");
    expect(sonuc[0].cumle).not.toContain("yaşıt");
  });

  it("ölçülemeyen alan kademe almaz ve cümle üretilmez", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Bilişsel Gelişim Alanları", ortalama: null }],
      new Map(),
      kazanimlar,
    );

    expect(sonuc[0].bant).toBeNull();
    expect(sonuc[0].cumle).toBeNull();
  });

  it("dönem ortası ölçümü verilirse ilerleme yorumu üretir", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.4 }],
      new Map([["Duygusal Gelişim Alanları", 4.3]]),
      kazanimlar,
      VARSAYILAN_ESIKLER,
      new Map([["Duygusal Gelişim Alanları", 3.6]]),
    );

    expect(sonuc[0].ortaOrtalamasi).toBe(3.6);
    expect(sonuc[0].degisim?.yon).toBe("ILERLEME");
    expect(sonuc[0].degisim?.cumle).toContain("duygusal beceriler");
  });

  it("dönem ortası ölçümü yoksa değişim alanı boş kalır", () => {
    const sonuc = gelisimAlanlariCikar(
      [{ kategori: "Duygusal Gelişim Alanları", ortalama: 4.4 }],
      new Map([["Duygusal Gelişim Alanları", 4.3]]),
      kazanimlar,
    );

    expect(sonuc[0].ortaOrtalamasi).toBeNull();
    expect(sonuc[0].degisim).toBeNull();
  });
});

describe("atolyeMetniUret", () => {
  const basliklar = (girdiler: [string, number][]): SoruOrtalamasi[] =>
    girdiler.map(([baslik, ortalama], sira) => ({
      anahtar: `s-${sira}`,
      soruMetni: "Soru",
      baslik,
      kategori: sira < 2 ? ILGI : YETENEK,
      ortalama,
      puanlananOturumSayisi: 10,
      puanToplami: ortalama * 10,
      sortOrder: sira,
    }));

  it("tam katılımda güçlü başlıkları ve yüksek kapanışı yazar", () => {
    const metin = atolyeMetniUret({
      ilkAd: "Zeynep",
      soruOrtalamalari: basliklar([
        ["Takım Çalışması ve İş Birliği", 4.4],
        ["Bilimsel Yöntemi Kullanma", 4.3],
        ["Kavramları Anlama", 3.7],
      ]),
      basari: KADEMELER.YUKSEK,
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });
    expect(metin).toContain(
      "değerlendirme kapsamındaki 10 oturumun tamamına katılmıştır",
    );
    expect(metin).toContain("takım çalışması ve iş birliği");
    expect(metin).toContain("bilimsel yöntemi kullanma");
    expect(metin).toContain("güçlü bir görünüm");
    // Kapanış kalıbı yazılmaz: skaladaki "Yüksek" aynı hükmü zaten veriyor.
    expect(metin).not.toContain("yüksek bulunmuştur");
    // 3,7 desteklenme eşiğinin (3,5) üstünde — eksik cümlesi zorlanmaz.
    expect(metin).not.toContain("desteklenmesinin faydalı");
  });

  it("geride kalan başlığı yalnızca eşik altındaysa anar", () => {
    const metin = atolyeMetniUret({
      ilkAd: "Mert",
      soruOrtalamalari: basliklar([
        ["Stratejik Düşünme", 4.2],
        ["Zihinsel Esneklik", 3.9],
        ["Mantıksal Akıl Yürütme", 3.1],
      ]),
      basari: KADEMELER.ORTALAMA,
      katildigiOturumSayisi: 8,
      katilmadigiOturumSayisi: 2,
    });
    expect(metin).toContain("10 oturumun 8'ine katılmıştır");
    expect(metin).toContain(
      "Mantıksal akıl yürütme başlığındaki gelişimi sürmekte",
    );
    // Ortalama kademede de kapanış kalıbı yazılmaz.
    expect(metin).not.toContain("beklenen aralıkta");
  });

  it("hiç katılmayan öğrencide değerlendirme cümlesi kurmaz", () => {
    const metin = atolyeMetniUret({
      ilkAd: "Şule",
      soruOrtalamalari: [],
      basari: null,
      katildigiOturumSayisi: 0,
      katilmadigiOturumSayisi: 1,
    });
    expect(metin).toBe(
      "Şule, bu atölyede değerlendirme kapsamındaki 1 oturuma katılamadığı için atölye içi değerlendirme oluşmamıştır.",
    );
  });

  it("başlıksız eski cevaplarda katılım ve kademe cümleleriyle yetinir", () => {
    const eskiler: SoruOrtalamasi[] = basliklar([["X", 4]]).map((s) => ({
      ...s,
      baslik: null,
    }));
    const metin = atolyeMetniUret({
      ilkAd: "Deniz",
      soruOrtalamalari: eskiler,
      basari: KADEMELER.YUKSEK,
      katildigiOturumSayisi: 10,
      katilmadigiOturumSayisi: 0,
    });
    expect(metin).toContain("tamamına katılmıştır");
    expect(metin).not.toContain("başlıklarında");
  });

  it("hiç oturum yoksa metin üretmez", () => {
    expect(
      atolyeMetniUret({
        ilkAd: "Bulut",
        soruOrtalamalari: [],
        basari: null,
        katildigiOturumSayisi: 0,
        katilmadigiOturumSayisi: 0,
      }),
    ).toBeNull();
  });

  it("katıldığı halde geçerli puanı yoksa yetersiz değerlendirme yazar", () => {
    const metin = atolyeMetniUret({
      ilkAd: "Alp",
      soruOrtalamalari: [],
      basari: null,
      katildigiOturumSayisi: 3,
      katilmadigiOturumSayisi: 0,
    });
    expect(metin).toContain("yeterli değerlendirme oluşmamıştır");
  });
});

describe("oturumEki", () => {
  it("sayının okunuşuna uyan eki üretir", () => {
    expect(oturumEki(6)).toBe("'sına");
    expect(oturumEki(8)).toBe("'ine");
    expect(oturumEki(9)).toBe("'una");
    expect(oturumEki(10)).toBe("'una");
    expect(oturumEki(12)).toBe("'sine");
    expect(oturumEki(20)).toBe("'sine");
    expect(oturumEki(30)).toBe("'una");
  });
});

describe("iyelikEki", () => {
  it("yalın iyelik ekini üretir", () => {
    expect(iyelikEki(2)).toBe("'si");
    expect(iyelikEki(43)).toBe("'ü");
    expect(iyelikEki(50)).toBe("'si");
    expect(iyelikEki(10)).toBe("'u");
  });
});
