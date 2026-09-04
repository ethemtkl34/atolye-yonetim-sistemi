import { describe, expect, it } from "vitest";
import {
  araliklarCakisiyorMu,
  gunEnum,
  gununDakikasi,
  mesaiIcindeMi,
  randevuAraligi,
  randevuEngeli,
  type MesaiAraligi,
  type MevcutRandevu,
} from "./cakisma";

/** "2026-09-07T09:00" → Date (duvar saati, UTC'de saklanıyor). */
const an = (metin: string) => new Date(`${metin}:00.000Z`);

/** 7 Eylül 2026 pazartesi. */
const PAZARTESI = "2026-09-07T";
const SALI = "2026-09-08T";

const mesai = (
  gun: MesaiAraligi["gun"],
  baslangicDk: number,
  bitisDk: number,
): MesaiAraligi => ({ gun, baslangicDk, bitisDk });

/** 09:00–18:00 pazartesi. */
const PAZARTESI_MESAISI = [mesai("PAZARTESI", 540, 1080)];

const randevu = (baslaSaat: string, sureDk: number) =>
  randevuAraligi(an(`${PAZARTESI}${baslaSaat}`), sureDk);

describe("gununDakikasi", () => {
  it("gece yarısından itibaren dakika verir", () => {
    expect(gununDakikasi(an(`${PAZARTESI}00:00`))).toBe(0);
    expect(gununDakikasi(an(`${PAZARTESI}09:00`))).toBe(540);
    expect(gununDakikasi(an(`${PAZARTESI}13:45`))).toBe(825);
  });
});

describe("gunEnum", () => {
  it("haftanın gününü doğru okur", () => {
    // 7 Eylül 2026 pazartesi, 13 Eylül pazar.
    expect(gunEnum(an(`${PAZARTESI}10:00`))).toBe("PAZARTESI");
    expect(gunEnum(an(`${SALI}10:00`))).toBe("SALI");
    expect(gunEnum(an("2026-09-13T10:00"))).toBe("PAZAR");
    expect(gunEnum(an("2026-09-12T10:00"))).toBe("CUMARTESI");
  });
});

describe("araliklarCakisiyorMu", () => {
  it("iç içe geçen aralıklar çakışır", () => {
    expect(
      araliklarCakisiyorMu(randevu("09:00", 60), randevu("09:30", 60)),
    ).toBe(true);
  });

  it("uç uca gelen aralıklar ÇAKIŞMAZ", () => {
    // 09:00–10:00 ile 10:00–11:00. Aksi hâlde arka arkaya seans hiç
    // açılamazdı — kuralın en çok kullanılan hâli bu.
    expect(
      araliklarCakisiyorMu(randevu("09:00", 60), randevu("10:00", 60)),
    ).toBe(false);
  });

  it("biri diğerini tamamen kapsıyorsa çakışır", () => {
    expect(
      araliklarCakisiyorMu(randevu("09:00", 180), randevu("10:00", 30)),
    ).toBe(true);
  });

  it("ayrık aralıklar çakışmaz", () => {
    expect(
      araliklarCakisiyorMu(randevu("09:00", 60), randevu("14:00", 60)),
    ).toBe(false);
  });
});

describe("mesaiIcindeMi", () => {
  it("aralığın içindeki seansı kabul eder", () => {
    expect(mesaiIcindeMi(randevu("10:00", 60), PAZARTESI_MESAISI)).toBe(true);
  });

  it("mesai sınırlarına tam oturan seansı kabul eder", () => {
    expect(mesaiIcindeMi(randevu("09:00", 540), PAZARTESI_MESAISI)).toBe(true);
  });

  it("BİTİŞİ mesai dışına taşan seansı reddeder", () => {
    // Asıl tuzak bu: 17:30'da açılan 90 dakikalık seans 19:00'da biter ve
    // uzman 18:00'da gitmiştir. "Başlangıcı mesai içinde" kontrolü yetmiyor.
    expect(mesaiIcindeMi(randevu("17:30", 90), PAZARTESI_MESAISI)).toBe(false);
  });

  it("mesai başlamadan açılan seansı reddeder", () => {
    expect(mesaiIcindeMi(randevu("08:00", 60), PAZARTESI_MESAISI)).toBe(false);
  });

  it("başka güne tanımlı mesaiyi kullanmaz", () => {
    const saliMesaisi = [mesai("SALI", 540, 1080)];
    expect(mesaiIcindeMi(randevu("10:00", 60), saliMesaisi)).toBe(false);
  });

  it("öğle arasına sarkan seansı reddeder", () => {
    // İki ayrı aralığın BİRLEŞİMİNE değil tek tek bakılıyor; 11:30'da
    // başlayan 90 dakikalık seans öğle arasını yiyor.
    const bolunmus = [
      mesai("PAZARTESI", 540, 720), // 09:00–12:00
      mesai("PAZARTESI", 780, 1080), // 13:00–18:00
    ];
    expect(mesaiIcindeMi(randevu("11:30", 90), bolunmus)).toBe(false);
    expect(mesaiIcindeMi(randevu("10:00", 60), bolunmus)).toBe(true);
    expect(mesaiIcindeMi(randevu("14:00", 60), bolunmus)).toBe(true);
  });

  it("gece yarısını aşan seansı reddeder", () => {
    const gece = [mesai("PAZARTESI", 0, 1440)];
    expect(mesaiIcindeMi(randevu("23:30", 60), gece)).toBe(false);
  });

  it("mesai tanımı yoksa hiçbir saat geçmez", () => {
    expect(mesaiIcindeMi(randevu("10:00", 60), [])).toBe(false);
  });
});

describe("randevuEngeli", () => {
  const temel = {
    mesailer: PAZARTESI_MESAISI,
    izinler: [] as { baslangic: Date; bitis: Date }[],
    mevcutlar: [] as MevcutRandevu[],
  };

  it("engel yoksa null döner", () => {
    expect(randevuEngeli({ ...temel, randevu: randevu("10:00", 60) })).toBeNull();
  });

  it("izni çakışma ve mesaiden ÖNCE bildirir", () => {
    // Uzman o gün hiç gelmiyorsa "o saat dolu" demek kullanıcıyı başka saat
    // denemeye iter; asıl cevap izin.
    const sonuc = randevuEngeli({
      ...temel,
      randevu: randevu("10:00", 60),
      izinler: [
        { baslangic: an(`${PAZARTESI}00:00`), bitis: an(`${SALI}00:00`) },
      ],
      mevcutlar: [
        { id: "r1", ...randevu("10:00", 60), iptal: false },
      ],
    });
    expect(sonuc?.tur).toBe("izin");
  });

  it("yarım gün izne denk gelen seansı engeller", () => {
    const ogledenSonraIzin = [
      { baslangic: an(`${PAZARTESI}13:00`), bitis: an(`${PAZARTESI}18:00`) },
    ];
    expect(
      randevuEngeli({
        ...temel,
        randevu: randevu("14:00", 60),
        izinler: ogledenSonraIzin,
      })?.tur,
    ).toBe("izin");
    // Sabah hâlâ açık.
    expect(
      randevuEngeli({
        ...temel,
        randevu: randevu("10:00", 60),
        izinler: ogledenSonraIzin,
      }),
    ).toBeNull();
  });

  it("mesai dışını çakışmadan önce bildirir", () => {
    const sonuc = randevuEngeli({
      ...temel,
      randevu: randevu("19:00", 60),
      mevcutlar: [{ id: "r1", ...randevu("19:00", 60), iptal: false }],
    });
    expect(sonuc?.tur).toBe("mesai");
  });

  it("mesai tanımsızsa sebebini ayrı yazar", () => {
    const sonuc = randevuEngeli({
      ...temel,
      randevu: randevu("10:00", 60),
      mesailer: [],
    });
    expect(sonuc?.mesaj).toBe("Uzmanın bu şubede tanımlı mesaisi yok.");
  });

  it("çakışan randevuyu kimliğiyle bildirir", () => {
    const sonuc = randevuEngeli({
      ...temel,
      randevu: randevu("10:00", 60),
      mevcutlar: [{ id: "dolu-1", ...randevu("10:30", 60), iptal: false }],
    });
    expect(sonuc).toEqual({
      tur: "cakisma",
      mesaj: "Uzmanın bu saatte başka bir randevusu var.",
      cakisanId: "dolu-1",
    });
  });

  it("İPTAL edilmiş randevu yer tutmaz", () => {
    // İptal edilen randevu takvimden düşüyor ama kayıtta duruyor; saatini
    // bloke etmeye devam etseydi iptal işe yaramazdı.
    expect(
      randevuEngeli({
        ...temel,
        randevu: randevu("10:00", 60),
        mevcutlar: [{ id: "iptal-1", ...randevu("10:00", 60), iptal: true }],
      }),
    ).toBeNull();
  });

  it("arka arkaya seans açılabilir", () => {
    expect(
      randevuEngeli({
        ...temel,
        randevu: randevu("10:00", 60),
        mevcutlar: [{ id: "onceki", ...randevu("09:00", 60), iptal: false }],
      }),
    ).toBeNull();
  });
});

describe("randevuAraligi", () => {
  it("hizmet süresinden bitişi hesaplar", () => {
    expect(randevuAraligi(an(`${PAZARTESI}09:00`), 120).bitis).toEqual(
      an(`${PAZARTESI}11:00`),
    );
    expect(randevuAraligi(an(`${PAZARTESI}09:00`), 90).bitis).toEqual(
      an(`${PAZARTESI}10:30`),
    );
  });
});
