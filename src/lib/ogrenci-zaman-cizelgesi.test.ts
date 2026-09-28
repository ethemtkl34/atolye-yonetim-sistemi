import { describe, expect, it } from "vitest";
import {
  zamanCizelgesiniKur,
  type HamOlay,
  type OlayTuru,
} from "./ogrenci-zaman-cizelgesi";

const olay = (
  id: string,
  tur: OlayTuru,
  an: string,
  ek: Partial<HamOlay> = {},
): HamOlay => ({
  id,
  tur,
  an: new Date(an),
  gunBazli: false,
  baslik: id,
  ayrinti: null,
  rozet: null,
  grupAnahtari: null,
  baskaSube: null,
  ilkAdayiMi: false,
  ...ek,
});

describe("zamanCizelgesiniKur — sıralama", () => {
  it("eskiden yeniye dizer", () => {
    const sonuc = zamanCizelgesiniKur([
      olay("b", "seans", "2026-12-06T10:00:00Z"),
      olay("a", "aday", "2026-11-30T09:00:00Z"),
    ]);
    expect(sonuc.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("AYNI GÜNDE saatli olaylar gerçek saatleriyle dizilir", () => {
    // Saatler gün içinde geri saymamalı: ilk denemede gün içi sıra tamamen
    // olay türüne bırakılmıştı ve 09:20'den 09:15'e dönüyordu.
    const sonuc = zamanCizelgesiniKur([
      olay("ucuncu", "randevuVerildi", "2026-11-30T16:00:00Z"),
      olay("ilk", "aday", "2026-11-30T09:00:00Z"),
      olay("ikinci", "ogrenciKaydi", "2026-11-30T14:00:00Z"),
    ]);
    expect(sonuc.map((o) => o.id)).toEqual(["ilk", "ikinci", "ucuncu"]);
  });

  it("GÜN BAZLI olay, aynı günün saatli olaylarından SONRA gelir", () => {
    // Gece yarısı bir saat değil "bu gün" demek; o kaydı günün başına koymak
    // bilmediğimiz bir şeyi iddia etmek olurdu.
    const sonuc = zamanCizelgesiniKur([
      olay("terapi", "terapi", "2026-11-30T00:00:00Z", { gunBazli: true }),
      olay("randevu", "randevuVerildi", "2026-11-30T14:00:00Z"),
      olay("aday", "aday", "2026-11-30T16:00:00Z"),
    ]);
    expect(sonuc.map((o) => o.id)).toEqual(["randevu", "aday", "terapi"]);
  });

  it("iki gün bazlı olay aynı güne düşerse tür sırası karar verir", () => {
    const sonuc = zamanCizelgesiniKur([
      olay("arsiv", "arsivRapor", "2026-11-30T00:00:00Z", { gunBazli: true }),
      olay("zeka", "zekaTesti", "2026-11-30T00:00:00Z", { gunBazli: true }),
    ]);
    expect(sonuc.map((o) => o.id)).toEqual(["zeka", "arsiv"]);
  });

  it("aynı gün ve aynı türde saate göre dizer", () => {
    const sonuc = zamanCizelgesiniKur([
      olay("ikinci", "seans", "2026-11-30T15:00:00Z"),
      olay("birinci", "seans", "2026-11-30T10:00:00Z"),
    ]);
    expect(sonuc.map((o) => o.id)).toEqual(["birinci", "ikinci"]);
  });

  it("her şey eşitse kimliğe göre KARARLI sıra verir", () => {
    const girdi = [
      olay("b", "seans", "2026-11-30T10:00:00Z"),
      olay("a", "seans", "2026-11-30T10:00:00Z"),
    ];
    expect(zamanCizelgesiniKur(girdi).map((o) => o.id)).toEqual(["a", "b"]);
    expect(zamanCizelgesiniKur([...girdi].reverse()).map((o) => o.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("girdiyi DEĞİŞTİRMEZ", () => {
    const girdi = [
      olay("b", "seans", "2026-12-06T10:00:00Z"),
      olay("a", "aday", "2026-11-30T09:00:00Z"),
    ];
    zamanCizelgesiniKur(girdi);
    expect(girdi.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

describe("zamanCizelgesiniKur — ilk seans rozeti", () => {
  const seans = (id: string, an: string, hizmet: string, gerceklesti = true) =>
    olay(id, "seans", an, { grupAnahtari: hizmet, ilkAdayiMi: gerceklesti });

  it("bir hizmetin YALNIZ ilk gerçekleşen seansını işaretler", () => {
    const sonuc = zamanCizelgesiniKur([
      seans("s2", "2026-12-06T10:00:00Z", "Oyun Terapisi"),
      seans("s1", "2026-11-30T10:00:00Z", "Oyun Terapisi"),
    ]);
    expect(sonuc.filter((o) => o.ilkMi).map((o) => o.id)).toEqual(["s1"]);
  });

  it("her hizmeti AYRI sayar", () => {
    // Çocuğun ikinci hizmetinin başlangıcı da işaretlenmeli.
    const sonuc = zamanCizelgesiniKur([
      seans("oyun", "2026-11-30T10:00:00Z", "Oyun Terapisi"),
      seans("duyu", "2026-12-06T10:00:00Z", "Duyu Bütünleme"),
    ]);
    expect(sonuc.filter((o) => o.ilkMi).map((o) => o.id)).toEqual(["oyun", "duyu"]);
  });

  it("GELMEDİĞİ seansı ilk saymaz", () => {
    // "İlk" yaşanmış olanı anlatır; gelinmeyen seans hikâyeyi başlatmaz.
    const sonuc = zamanCizelgesiniKur([
      seans("gelmedi", "2026-11-30T10:00:00Z", "Oyun Terapisi", false),
      seans("geldi", "2026-12-06T10:00:00Z", "Oyun Terapisi"),
    ]);
    expect(sonuc.filter((o) => o.ilkMi).map((o) => o.id)).toEqual(["geldi"]);
  });

  it("seans olmayan olayı işaretlemez", () => {
    const sonuc = zamanCizelgesiniKur([
      olay("terapi", "terapi", "2026-11-30T00:00:00Z", {
        grupAnahtari: "Oyun Terapisi",
        ilkAdayiMi: true,
      }),
    ]);
    expect(sonuc.every((o) => !o.ilkMi)).toBe(true);
  });
});

describe("zamanCizelgesiniKur — kurumun örneği", () => {
  it("örnekteki dört satırı beklenen sırada üretir", () => {
    const sonuc = zamanCizelgesiniKur([
      olay("r1", "seans", "2026-12-06T11:00:00Z", {
        grupAnahtari: "Oyun Terapisi",
        ilkAdayiMi: true,
      }),
      olay("a1", "aday", "2026-11-30T09:00:00Z", { ayrinti: "Meta reklamı" }),
      olay("r0", "seans", "2026-11-30T11:00:00Z", {
        grupAnahtari: "Oyun Terapisi",
        ilkAdayiMi: true,
      }),
      olay("rv", "randevuVerildi", "2026-11-30T09:30:00Z"),
    ]);
    expect(sonuc.map((o) => `${o.id}${o.ilkMi ? "*" : ""}`)).toEqual([
      "a1",
      "rv",
      "r0*",
      "r1",
    ]);
  });
});
