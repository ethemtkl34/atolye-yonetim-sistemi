import { describe, expect, it } from "vitest";
import {
  cevapCozumle,
  DEGERLENDIRILEMEDI,
  formSatirlariOlustur,
  gorevOzeti,
  oturumPuanlanabilirMi,
  puanlamaDurumu,
  type MevcutCevap,
  type PuanlamaDurumu,
} from "./puanlama";

const SORULAR = ["s1", "s2", "s3"];

describe("puanlamaDurumu", () => {
  it("hiç form açılmamışsa BOS döner", () => {
    expect(puanlamaDurumu(null, SORULAR)).toBe("BOS");
  });

  it("katılmadı işaretliyse soru beklemez", () => {
    // §10.2 — Katılmadı seçildiğinde puanlama soruları doldurulmaz.
    const durum = puanlamaDurumu(
      { attended: false, cevaplananSoruIdleri: [] },
      SORULAR,
    );
    expect(durum).toBe("KATILMADI");
  });

  it("bütün aktif sorular cevaplanmışsa TAMAM döner", () => {
    const durum = puanlamaDurumu(
      { attended: true, cevaplananSoruIdleri: ["s1", "s2", "s3"] },
      SORULAR,
    );
    expect(durum).toBe("TAMAM");
  });

  it("eksik cevaplanmış katıldı formu EKSIK döner", () => {
    // §10.3 — Katıldıysa bütün soruların cevaplanması zorunludur.
    const durum = puanlamaDurumu(
      { attended: true, cevaplananSoruIdleri: ["s1", "s2"] },
      SORULAR,
    );
    expect(durum).toBe("EKSIK");
  });

  it("cevap sayısı yeterli olsa da farklı sorular cevaplanmışsa EKSIK döner", () => {
    // Koordinatör s3'ü pasife alıp s4 eklediğinde sayı hâlâ 3'tür ama form
    // gerçekte eksiktir. Bu yüzden karşılaştırma kimlik üzerinden yapılıyor.
    const durum = puanlamaDurumu(
      { attended: true, cevaplananSoruIdleri: ["s1", "s2", "s3"] },
      ["s1", "s2", "s4"],
    );
    expect(durum).toBe("EKSIK");
  });

  it("aktif sorusu olmayan atölyede katıldı formu tamam sayılır", () => {
    const durum = puanlamaDurumu(
      { attended: true, cevaplananSoruIdleri: [] },
      [],
    );
    expect(durum).toBe("TAMAM");
  });
});

describe("gorevOzeti", () => {
  it("doldurulmamış ve eksik formları birlikte bekleyen sayar", () => {
    // §12.3 — Stajyer ekranında ayrım "doldurulmuş / doldurulmamış".
    const durumlar: PuanlamaDurumu[] = [
      "TAMAM",
      "TAMAM",
      "KATILMADI",
      "EKSIK",
      "BOS",
    ];
    const ozet = gorevOzeti(durumlar);

    expect(ozet.toplam).toBe(5);
    expect(ozet.dolduruldu).toBe(2);
    expect(ozet.katilmadi).toBe(1);
    expect(ozet.bekleyen).toBe(2);
    expect(ozet.tamamlandi).toBe(false);
  });

  it("katılmadı işaretli formlar tamamlanmayı engellemez", () => {
    const ozet = gorevOzeti(["TAMAM", "KATILMADI"]);
    expect(ozet.bekleyen).toBe(0);
    expect(ozet.tamamlandi).toBe(true);
  });

  it("hiç oturum yoksa tamamlandı saymaz", () => {
    expect(gorevOzeti([]).tamamlandi).toBe(false);
  });
});

describe("cevapCozumle", () => {
  it("1–5 arası puanları kabul eder", () => {
    expect(cevapCozumle("1")).toEqual({ gecerli: true, deger: 1 });
    expect(cevapCozumle("5")).toEqual({ gecerli: true, deger: 5 });
  });

  it("Değerlendirilemedi seçeneğini null değere çevirir", () => {
    // §10.4 — Ortalamaya dahil edilmez; "cevapsız" ile aynı şey değildir.
    expect(cevapCozumle(DEGERLENDIRILEMEDI)).toEqual({
      gecerli: true,
      deger: null,
    });
  });

  it("boş, ölçek dışı ve sayı olmayan girdileri reddeder", () => {
    expect(cevapCozumle("").gecerli).toBe(false);
    expect(cevapCozumle(null).gecerli).toBe(false);
    expect(cevapCozumle(undefined).gecerli).toBe(false);
    expect(cevapCozumle("0").gecerli).toBe(false);
    expect(cevapCozumle("6").gecerli).toBe(false);
    expect(cevapCozumle("-3").gecerli).toBe(false);
    expect(cevapCozumle("4.5").gecerli).toBe(false);
    expect(cevapCozumle("iyi").gecerli).toBe(false);
  });
});

describe("formSatirlariOlustur", () => {
  const sorular = [
    { id: "s1", text: "İlgi gösterir.", sortOrder: 0 },
    { id: "s2", text: "Katılım sağlar.", sortOrder: 1 },
  ];

  function cevap(ozel: Partial<MevcutCevap>): MevcutCevap {
    return {
      id: "c1",
      questionId: "s1",
      questionTextSnapshot: "İlgi gösterir.",
      value: 4,
      sortOrder: 0,
      ...ozel,
    };
  }

  it("boş formda soruları sırasıyla ve cevapsız üretir", () => {
    const satirlar = formSatirlariOlustur(sorular, []);

    expect(satirlar.map((s) => s.anahtar)).toEqual(["q:s1", "q:s2"]);
    expect(satirlar.every((s) => !s.cevaplandi)).toBe(true);
    expect(satirlar[0].mevcutDeger).toBeNull();
  });

  it("mevcut cevapları ilgili satıra yerleştirir", () => {
    const satirlar = formSatirlariOlustur(sorular, [cevap({ value: 3 })]);

    expect(satirlar[0].mevcutDeger).toBe(3);
    expect(satirlar[0].cevaplandi).toBe(true);
    expect(satirlar[1].cevaplandi).toBe(false);
  });

  it("soru metni sonradan değişse de o günkü metni gösterir", () => {
    // §13.14 — Geçmiş değerlendirme o gün sorulan metinle görünür; güncel
    // metin yalnızca bilgi olarak taşınır ve snapshot değişmez.
    const satirlar = formSatirlariOlustur(sorular, [
      cevap({ questionTextSnapshot: "Eski metin" }),
    ]);

    expect(satirlar[0].metin).toBe("Eski metin");
    expect(satirlar[0].guncelMetin).toBe("İlgi gösterir.");
    expect(satirlar[0].kaydedilecekMetin).toBe("Eski metin");
  });

  it("yeni açılan satır bugünkü metni kaydeder", () => {
    const satirlar = formSatirlariOlustur(sorular, []);
    expect(satirlar[0].kaydedilecekMetin).toBe("İlgi gösterir.");
    expect(satirlar[0].guncelMetin).toBeNull();
  });

  it("pasife alınmış sorunun geçmiş cevabını sonda korur", () => {
    const satirlar = formSatirlariOlustur(sorular, [
      cevap({
        id: "c9",
        questionId: "eski-soru",
        questionTextSnapshot: "Kaldırılmış kriter",
        value: 2,
        sortOrder: 9,
      }),
    ]);

    expect(satirlar).toHaveLength(3);
    expect(satirlar[2].anahtar).toBe("q:eski-soru");
    expect(satirlar[2].aktif).toBe(false);
    expect(satirlar[2].mevcutDeger).toBe(2);
  });

  it("büsbütün silinmiş sorunun cevabını kendi kimliğiyle taşır", () => {
    const satirlar = formSatirlariOlustur(sorular, [
      cevap({ id: "c7", questionId: null, questionTextSnapshot: "Silinmiş" }),
    ]);

    expect(satirlar[2].anahtar).toBe("a:c7");
    expect(satirlar[2].questionId).toBeNull();
    expect(satirlar[2].metin).toBe("Silinmiş");
  });
});

describe("oturumPuanlanabilirMi", () => {
  const bugun = new Date(Date.UTC(2026, 7, 8));

  it("bugünkü ve geçmiş oturumlar puanlanabilir", () => {
    expect(oturumPuanlanabilirMi(new Date(Date.UTC(2026, 7, 8)), bugun)).toBe(
      true,
    );
    expect(oturumPuanlanabilirMi(new Date(Date.UTC(2026, 7, 1)), bugun)).toBe(
      true,
    );
  });

  it("henüz yapılmamış oturum puanlanamaz", () => {
    expect(oturumPuanlanabilirMi(new Date(Date.UTC(2026, 7, 15)), bugun)).toBe(
      false,
    );
  });
});
