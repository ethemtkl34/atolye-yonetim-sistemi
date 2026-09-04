import { describe, expect, it } from "vitest";
import {
  EN_FAZLA_TEKRAR_HAFTASI,
  kapsamdakiRandevular,
  tekrarTarihleri,
} from "./tekrar";

const an = (metin: string) => new Date(`${metin}:00.000Z`);

describe("tekrarTarihleri", () => {
  it("ilk eleman randevunun kendisi", () => {
    const ilk = an("2026-09-07T14:00");
    expect(tekrarTarihleri(ilk, 4)[0]).toEqual(ilk);
  });

  it("tam yedi gün aralıklı üretir", () => {
    const tarihler = tekrarTarihleri(an("2026-09-07T14:00"), 4);
    expect(tarihler.map((t) => t.toISOString())).toEqual([
      "2026-09-07T14:00:00.000Z",
      "2026-09-14T14:00:00.000Z",
      "2026-09-21T14:00:00.000Z",
      "2026-09-28T14:00:00.000Z",
    ]);
  });

  it("hafta sayısı 1 ise tek randevu — belgenin harfi harfine hâli", () => {
    expect(tekrarTarihleri(an("2026-09-07T14:00"), 1)).toHaveLength(1);
  });

  it("ay ve yıl sınırını geçebilir", () => {
    const tarihler = tekrarTarihleri(an("2026-12-28T10:00"), 3);
    expect(tarihler.map((t) => t.toISOString().slice(0, 10))).toEqual([
      "2026-12-28",
      "2027-01-04",
      "2027-01-11",
    ]);
  });

  it("saat ve gün korunur — yaz saati geçişinde kaymaz", () => {
    // Türkiye'de saat değişimi kalktı ama sunucu her yerde olabilir; hesap
    // milisaniye üzerinden ve tarihler duvar saati olarak UTC'de saklanıyor.
    // Ekim sonundan kasıma geçen bir seri 14:00'ta kalmalı.
    const tarihler = tekrarTarihleri(an("2026-10-19T14:00"), 4);
    for (const tarih of tarihler) {
      expect([tarih.getUTCHours(), tarih.getUTCDay()]).toEqual([14, 1]);
    }
  });

  it("sınırların dışına çıkmaz", () => {
    expect(tekrarTarihleri(an("2026-09-07T14:00"), 0)).toHaveLength(1);
    expect(tekrarTarihleri(an("2026-09-07T14:00"), -5)).toHaveLength(1);
    expect(tekrarTarihleri(an("2026-09-07T14:00"), 500)).toHaveLength(
      EN_FAZLA_TEKRAR_HAFTASI,
    );
  });

  it("ondalık hafta sayısını aşağı yuvarlar", () => {
    expect(tekrarTarihleri(an("2026-09-07T14:00"), 3.9)).toHaveLength(3);
  });
});

describe("kapsamdakiRandevular", () => {
  const seri = [
    { id: "a", baslangic: an("2026-09-07T14:00") },
    { id: "b", baslangic: an("2026-09-14T14:00") },
    { id: "c", baslangic: an("2026-09-21T14:00") },
    { id: "d", baslangic: an("2026-09-28T14:00") },
  ];

  it("yalnız bu: tek randevu", () => {
    expect(
      kapsamdakiRandevular(seri, seri[1], "yalniz-bu").map((r) => r.id),
    ).toEqual(["b"]);
  });

  it("bu ve sonrakiler: geçmişe DOKUNMAZ", () => {
    // Seçilenden öncekiler yapılmış seanslar; iptal edilemez.
    expect(
      kapsamdakiRandevular(seri, seri[1], "bu-ve-sonrakiler").map((r) => r.id),
    ).toEqual(["b", "c", "d"]);
  });

  it("ilk randevu seçilirse serinin tamamı", () => {
    expect(
      kapsamdakiRandevular(seri, seri[0], "bu-ve-sonrakiler"),
    ).toHaveLength(4);
  });

  it("son randevu seçilirse yalnız kendisi", () => {
    expect(
      kapsamdakiRandevular(seri, seri[3], "bu-ve-sonrakiler").map((r) => r.id),
    ).toEqual(["d"]);
  });

  it("kapsam SIRAYA değil TARİHE bakar", () => {
    // Araya elle eklenen telafi randevusu listenin sonunda durabilir ama
    // tarihi ortada; doğru tarafta kalmalı.
    const telafili = [
      ...seri,
      { id: "telafi", baslangic: an("2026-09-10T14:00") },
    ];
    expect(
      kapsamdakiRandevular(telafili, seri[1], "bu-ve-sonrakiler").map(
        (r) => r.id,
      ),
    ).toEqual(["b", "c", "d"]);
    expect(
      kapsamdakiRandevular(telafili, seri[0], "bu-ve-sonrakiler").map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b", "c", "d", "telafi"]);
  });
});
