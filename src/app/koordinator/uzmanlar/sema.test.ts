import { describe, expect, it } from "vitest";
import {
  dakikayiSaateCevir,
  hizmetSemasi,
  kurustanLiraya,
  liradanKurusa,
  mesaiSemasi,
  paraMetni,
  saatiDakikayaCevir,
  sureMetni,
} from "./sema";

describe("saat ↔ dakika", () => {
  it("gece yarısından itibaren dakikaya çevirir", () => {
    expect(saatiDakikayaCevir("00:00")).toBe(0);
    expect(saatiDakikayaCevir("09:00")).toBe(540);
    expect(saatiDakikayaCevir("13:45")).toBe(825);
    expect(saatiDakikayaCevir("23:59")).toBe(1439);
  });

  it("geçersiz saatte null döner", () => {
    // Mesai kaydı bu null'a bakıyor; geçersiz girdi 0'a yuvarlansaydı
    // "24:00" yazan kullanıcı gece yarısına mesai açmış olurdu.
    expect(saatiDakikayaCevir("24:00")).toBeNull();
    expect(saatiDakikayaCevir("9:00")).toBeNull();
    expect(saatiDakikayaCevir("09:60")).toBeNull();
    expect(saatiDakikayaCevir("")).toBeNull();
    expect(saatiDakikayaCevir("öğlen")).toBeNull();
  });

  it("boşluklu girdiyi kabul eder", () => {
    expect(saatiDakikayaCevir(" 09:00 ")).toBe(540);
  });

  it("geri çevirim iki basamaklı yazar", () => {
    expect(dakikayiSaateCevir(540)).toBe("09:00");
    expect(dakikayiSaateCevir(0)).toBe("00:00");
    expect(dakikayiSaateCevir(825)).toBe("13:45");
  });

  it("gidiş dönüş değeri korur", () => {
    for (const saat of ["00:00", "07:30", "12:05", "18:45", "23:59"]) {
      expect(dakikayiSaateCevir(saatiDakikayaCevir(saat)!)).toBe(saat);
    }
  });
});

describe("para", () => {
  it("lirayı kuruşa çevirir", () => {
    expect(liradanKurusa(3200)).toBe(320000);
    expect(liradanKurusa(7800)).toBe(780000);
    expect(liradanKurusa(0)).toBe(0);
  });

  it("kuruşlu tutarda kayan nokta artığı bırakmaz", () => {
    // Paranın `Float` tutulmamasının sebebi bu: 8500.50 * 100 ikilik kayan
    // noktada 850049.9999… veriyor ve yuvarlanmasaydı her kayıtta bir kuruş
    // kaybolurdu.
    expect(liradanKurusa(8500.5)).toBe(850050);
    expect(liradanKurusa(0.1)).toBe(10);
    expect(liradanKurusa(1234.56)).toBe(123456);
  });

  it("gidiş dönüş değeri korur", () => {
    for (const lira of [0, 0.5, 3200, 7800, 8500.5, 1234.56]) {
      expect(kurustanLiraya(liradanKurusa(lira))).toBe(lira);
    }
  });

  it("Türk lirası biçiminde yazar", () => {
    // Boşluk karakteri yerele göre değişebiliyor (normal boşluk / dar boşluk);
    // rakam ve simge kısmı sabit.
    expect(paraMetni(780000).replace(/\s/g, " ")).toBe("₺7.800,00");
    expect(paraMetni(850050).replace(/\s/g, " ")).toBe("₺8.500,50");
    expect(paraMetni(0).replace(/\s/g, " ")).toBe("₺0,00");
  });
});

describe("sureMetni", () => {
  it("saat ve dakikayı okunur yazar", () => {
    expect(sureMetni(30)).toBe("30 dk");
    expect(sureMetni(60)).toBe("1 sa");
    expect(sureMetni(90)).toBe("1 sa 30 dk");
    expect(sureMetni(120)).toBe("2 sa");
    expect(sureMetni(125)).toBe("2 sa 5 dk");
  });
});

describe("mesaiSemasi", () => {
  const temel = {
    gun: "PAZARTESI" as const,
    subeId: "sube_umraniye",
    baslangic: "09:00",
    bitis: "18:00",
  };

  it("geçerli aralığı kabul eder", () => {
    expect(mesaiSemasi.safeParse(temel).success).toBe(true);
  });

  it("bitiş başlangıçtan önceyse reddeder", () => {
    const sonuc = mesaiSemasi.safeParse({
      ...temel,
      baslangic: "18:00",
      bitis: "09:00",
    });
    expect(sonuc.success).toBe(false);
  });

  it("sıfır uzunluklu aralığı reddeder", () => {
    // 09:00–09:00 bir mesai değil; kabul edilseydi "bu saat mesai içinde mi"
    // sorusu hiçbir zaman evet dönmeyen bir kayıt üretirdi.
    const sonuc = mesaiSemasi.safeParse({
      ...temel,
      baslangic: "09:00",
      bitis: "09:00",
    });
    expect(sonuc.success).toBe(false);
  });

  it("biçimsiz saati reddeder", () => {
    expect(
      mesaiSemasi.safeParse({ ...temel, baslangic: "9" }).success,
    ).toBe(false);
  });
});

describe("hizmetSemasi", () => {
  const temel = {
    ad: "Oyun Temelli Danışmanlık",
    grup: "DANISMANLIK" as const,
    sureDk: "60",
    ucretLira: "3200",
    yasAlt: "",
    yasUst: "",
    danisanTuru: "COCUK" as const,
    tekrarli: true,
  };

  it("metin gelen sayıları çevirir", () => {
    const sonuc = hizmetSemasi.safeParse(temel);
    expect(sonuc.success).toBe(true);
    if (sonuc.success) {
      expect(sonuc.data.sureDk).toBe(60);
      expect(sonuc.data.ucretLira).toBe(3200);
    }
  });

  it("boş yaş alanlarını null yapar", () => {
    // Form boş bırakılan yaşı "" gönderiyor; 0 sayılsaydı "0 yaş üstü" gibi
    // bir sınır uydurulmuş olurdu.
    const sonuc = hizmetSemasi.safeParse(temel);
    if (!sonuc.success) throw new Error("geçerli olmalıydı");
    expect(sonuc.data.yasAlt).toBeNull();
    expect(sonuc.data.yasUst).toBeNull();
  });

  it("ücretsiz hizmete izin verir", () => {
    // Atölye görüşmesi ücretsiz; sıfır serbest, eksi değil.
    expect(
      hizmetSemasi.safeParse({ ...temel, ucretLira: "0" }).success,
    ).toBe(true);
    expect(
      hizmetSemasi.safeParse({ ...temel, ucretLira: "-1" }).success,
    ).toBe(false);
  });

  it("sıfır ve aşırı süreyi reddeder", () => {
    expect(hizmetSemasi.safeParse({ ...temel, sureDk: "0" }).success).toBe(
      false,
    );
    expect(hizmetSemasi.safeParse({ ...temel, sureDk: "481" }).success).toBe(
      false,
    );
  });

  it("katalogdaki gerçek sürelerin hepsini kabul eder", () => {
    // Arayüzdeki `step` ile `min` uyumsuzluğu bu süreleri sessizce
    // reddetmişti (min=1/step=5 → 120 geçersiz); şema tarafında da
    // takılmadıklarından emin olalım.
    for (const sure of [30, 60, 90, 120]) {
      const sonuc = hizmetSemasi.safeParse({ ...temel, sureDk: String(sure) });
      expect([sure, sonuc.success]).toEqual([sure, true]);
    }
  });
});
