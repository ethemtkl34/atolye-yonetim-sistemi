import { describe, expect, it } from "vitest";
import {
  BECERI_ETIKETLERI,
  beceriEtiketiCikar,
} from "./beceri-etiketleri";
import { GERCEK_BASLIKLAR } from "./__fixtures__/gercek-basliklar";
import {
  urunOnerileriSec,
  urunsuzAlanlar,
  type OneriAdayi,
} from "./urun-onerileri";

function urun(
  id: string,
  beceriler: string[],
  ek: Partial<OneriAdayi> = {},
): OneriAdayi {
  return {
    id,
    ad: `Ürün ${id}`,
    url: `https://zetzeka.com/urun/${id}/`,
    kategori: "oyun",
    yasMin: 5,
    yasMax: 99,
    alanlar: ["BILISSEL"],
    beceriler,
    workshopTypeId: null,
    ...ek,
  };
}

const BOS = {
  yas: 9,
  desteklenecekBasliklar: [],
  gucluBasliklar: [],
  ilgiliAtolyeIdleri: [],
};

describe("beceriEtiketiCikar", () => {
  it("atölyeye göre değişen soru başlıklarını ortak etikete indirger", () => {
    expect(beceriEtiketiCikar("Gözlem ve Analiz Yeteneği")).toBe("akil-yurutme");
    expect(beceriEtiketiCikar("Bilimsel Düşünme Becerisi")).toBe("akil-yurutme");
    expect(beceriEtiketiCikar("Dikkat ve Konsantrasyon")).toBe("odaklanma");
    expect(beceriEtiketiCikar("Takım Çalışması ve İş Birliği")).toBe(
      "is-birligi",
    );
    expect(beceriEtiketiCikar("Duygu Düzenleme")).toBe("duygu-yonetimi");
  });

  it("eşleşmeyen başlık için etiket uydurmaz", () => {
    expect(beceriEtiketiCikar("Fotosentez")).toBeNull();
  });

  it("ürettiği her etiket kapalı listeden çıkar", () => {
    for (const baslik of GERCEK_BASLIKLAR) {
      const etiket = beceriEtiketiCikar(baslik);
      if (etiket !== null) {
        expect(BECERI_ETIKETLERI).toContain(etiket);
      }
    }
  });

  it("canlıdaki BECERİ başlıklarının tamamını eşleştirir", () => {
    // İLGİ başlıkları ("Evren ve Gezegenlere İlgi") kasten eşleşmez: onlar
    // bir beceri değil, ilgi ölçümüdür ve ürün önerisine kaynak olmazlar.
    // Ürün önerisi ilgiye atölye bağı üzerinden bakar.
    // Türkçe "İ" harfi JavaScript'in /i/ bayrağıyla "i"ye eşleşmez; küçültme
    // önce ve tr-TR yerel ayarıyla yapılmalı.
    const ilgiBasligi = (baslik: string) =>
      /ilgi|istek|isteğ|açıklık|katılım|bilgisi|keşfet/.test(
        baslik.toLocaleLowerCase("tr-TR"),
      );

    const eslesmeyenler = GERCEK_BASLIKLAR.filter(
      (baslik) => !ilgiBasligi(baslik) && beceriEtiketiCikar(baslik) === null,
    );

    expect(eslesmeyenler).toEqual([]);
  });
});

describe("urunOnerileriSec", () => {
  it("yaş aralığı dışındaki ürünü önermez", () => {
    // Katalogdaki duygusal ürünler 4-7 yaş; öğrencilerimiz 8-11.
    const duygusal = urun("duygularim", ["duygu-yonetimi"], {
      yasMin: 4,
      yasMax: 7,
      alanlar: ["DUYGUSAL"],
    });

    const sonuc = urunOnerileriSec([duygusal], {
      ...BOS,
      yas: 9,
      desteklenecekBasliklar: ["Duygu Düzenleme"],
    });

    expect(sonuc).toHaveLength(0);
  });

  it("uygun ürün yoksa boş döner — bu normal bir sonuçtur", () => {
    expect(urunOnerileriSec([], BOS)).toEqual([]);
  });

  it("atölye bağı olan ürünü önce önerir", () => {
    const genel = urun("genel", ["stratejik-dusunme"]);
    const atolyeli = urun("torappu", ["stratejik-dusunme"], {
      workshopTypeId: "atl-zeka",
    });

    const sonuc = urunOnerileriSec([genel, atolyeli], {
      ...BOS,
      ilgiliAtolyeIdleri: ["atl-zeka"],
      desteklenecekBasliklar: ["Stratejik Düşünme"],
    });

    expect(sonuc[0].urun.id).toBe("torappu");
    expect(sonuc[0].gerekce).toBe("ATOLYE_BAGI");
  });

  it("desteklenecek alan güçlü alandan önce gelir", () => {
    const sonuc = urunOnerileriSec(
      [urun("a", ["odaklanma"]), urun("b", ["is-birligi"])],
      {
        ...BOS,
        gucluBasliklar: ["Takım Çalışması"],
        desteklenecekBasliklar: ["Dikkat ve Konsantrasyon"],
      },
    );

    expect(sonuc.map((s) => s.gerekce)).toEqual([
      "DESTEKLENECEK_ALAN",
      "GUCLU_ALAN",
    ]);
  });

  it("en fazla üç ürün önerir", () => {
    const adaylar = [
      urun("a", ["odaklanma"]),
      urun("b", ["is-birligi"]),
      urun("c", ["ince-motor"]),
      urun("d", ["iletisim"]),
      urun("e", ["problem-cozme"]),
    ];

    const sonuc = urunOnerileriSec(adaylar, {
      ...BOS,
      desteklenecekBasliklar: [
        "Dikkat ve Konsantrasyon",
        "İş Birliği",
        "İnce Motor",
        "İletişim Becerisi",
        "Problem Çözme",
      ],
    });

    expect(sonuc).toHaveLength(3);
  });

  it("aynı beceri için iki ürün önermez — liste tek konuya yığılmaz", () => {
    const sonuc = urunOnerileriSec(
      [urun("a", ["odaklanma"]), urun("b", ["odaklanma"])],
      {
        ...BOS,
        desteklenecekBasliklar: ["Dikkat ve Konsantrasyon", "Odaklanma"],
      },
    );

    expect(sonuc).toHaveLength(1);
  });

  it("aynı ürünü iki kez önermez", () => {
    const cokBecerili = urun("a", ["odaklanma", "problem-cozme"]);

    const sonuc = urunOnerileriSec([cokBecerili], {
      ...BOS,
      desteklenecekBasliklar: ["Dikkat ve Konsantrasyon", "Problem Çözme"],
    });

    expect(sonuc).toHaveLength(1);
  });

  it("yaş bilinmiyorsa süzgeç uygulanmaz", () => {
    const kucukYas = urun("a", ["duygu-yonetimi"], { yasMin: 4, yasMax: 7 });

    const sonuc = urunOnerileriSec([kucukYas], {
      ...BOS,
      yas: null,
      desteklenecekBasliklar: ["Duygu Düzenleme"],
    });

    expect(sonuc).toHaveLength(1);
  });
});

describe("urunsuzAlanlar", () => {
  it("karşılanamayan gelişim alanını bildirir", () => {
    const secilenler = urunOnerileriSec([urun("a", ["odaklanma"])], {
      ...BOS,
      desteklenecekBasliklar: ["Dikkat"],
    });

    expect(urunsuzAlanlar(secilenler, ["DUYGUSAL", "SOSYAL", "BILISSEL"]))
      .toEqual(["DUYGUSAL", "SOSYAL"]);
  });

  it("hepsi karşılandıysa boş döner", () => {
    const secilenler = urunOnerileriSec(
      [urun("a", ["duygu-yonetimi"], { alanlar: ["DUYGUSAL"] })],
      { ...BOS, desteklenecekBasliklar: ["Duygu Düzenleme"] },
    );

    expect(urunsuzAlanlar(secilenler, ["DUYGUSAL"])).toEqual([]);
  });
});
