import { describe, expect, it } from "vitest";
import {
  GELISIM_SORULARI,
  gelisimCevaplariCozumle,
  gelisimDurumu,
  gelisimPencereleri,
} from "./gelisim-degerlendirmesi";

/** 10 haftalık takvim: 1. hafta 6 Haziran, haftada bir gün. */
function haftalar(adet: number): { weekNumber: number; date: Date }[] {
  return Array.from({ length: adet }, (_, i) => ({
    weekNumber: i + 1,
    date: new Date(Date.UTC(2026, 5, 6 + i * 7)),
  }));
}

describe("GELISIM_SORULARI", () => {
  it("üç kategoride 18 soru içerir", () => {
    expect(GELISIM_SORULARI).toHaveLength(18);

    const kategoriler = [...new Set(GELISIM_SORULARI.map((s) => s.kategori))];
    expect(kategoriler).toEqual([
      "Duygusal Gelişim Alanları",
      "Sosyal Gelişim Alanları",
      "Bilişsel Gelişim Alanları",
    ]);
  });

  it("anahtarlar benzersizdir (form alanı adları çakışamaz)", () => {
    const anahtarlar = GELISIM_SORULARI.map((s) => s.anahtar);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("aynı kategorinin soruları ardışıktır (bölüm başlığı bir kez basılır)", () => {
    const gorulen = new Set<string>();
    let onceki: string | null = null;

    for (const soru of GELISIM_SORULARI) {
      if (soru.kategori !== onceki) {
        expect(gorulen.has(soru.kategori)).toBe(false);
        gorulen.add(soru.kategori);
        onceki = soru.kategori;
      }
    }
  });
});

describe("gelisimPencereleri", () => {
  it("10 haftalık dönemde ortası 5. haftada, sonu 10. haftada açılır", () => {
    const takvim = haftalar(10);
    // 5. haftanın günü: 4 Temmuz 2026.
    const besinciHafta = takvim[4].date;
    const onuncuHafta = takvim[9].date;

    const oncesi = gelisimPencereleri(
      takvim,
      new Date(Date.UTC(2026, 5, 20)),
    );
    expect(oncesi.DONEM_ORTASI.acik).toBe(false);
    expect(oncesi.DONEM_ORTASI.acilisTarihi).toEqual(besinciHafta);
    expect(oncesi.DONEM_SONU.acik).toBe(false);

    const ortada = gelisimPencereleri(takvim, besinciHafta);
    expect(ortada.DONEM_ORTASI.acik).toBe(true);
    expect(ortada.DONEM_SONU.acik).toBe(false);

    const sonda = gelisimPencereleri(takvim, onuncuHafta);
    expect(sonda.DONEM_SONU.acik).toBe(true);
    expect(sonda.DONEM_SONU.acilisTarihi).toEqual(onuncuHafta);
  });

  it("tek sayılı hafta sayısında orta hafta yukarı yuvarlanır", () => {
    // 9 haftada orta nokta 5. hafta (ceil(9/2) = 5).
    const takvim = haftalar(9);
    const pencereler = gelisimPencereleri(
      takvim,
      new Date(Date.UTC(2026, 0, 1)),
    );
    expect(pencereler.DONEM_ORTASI.acilisTarihi).toEqual(takvim[4].date);
  });

  it("hafta listesi karışık sırada gelse de aynı sonucu verir", () => {
    const takvim = haftalar(10);
    const karisik = [...takvim].reverse();
    expect(gelisimPencereleri(karisik, new Date(Date.UTC(2026, 0, 1)))).toEqual(
      gelisimPencereleri(takvim, new Date(Date.UTC(2026, 0, 1))),
    );
  });

  it("takvimi olmayan grupta kilit uygulanmaz", () => {
    // Takvimsiz kaydın testini süresiz kilitlemek doldurmayı imkânsız kılardı.
    const pencereler = gelisimPencereleri([], new Date(Date.UTC(2026, 0, 1)));
    expect(pencereler.DONEM_ORTASI).toEqual({ acik: true, acilisTarihi: null });
    expect(pencereler.DONEM_SONU).toEqual({ acik: true, acilisTarihi: null });
  });
});

describe("gelisimDurumu", () => {
  const acik = { acik: true, acilisTarihi: null };
  const kapali = { acik: false, acilisTarihi: new Date(Date.UTC(2026, 6, 4)) };

  it("doldurulmuş test her zaman DOLDURULDU", () => {
    expect(gelisimDurumu(true, kapali)).toBe("DOLDURULDU");
  });

  it("açılmamış pencere KILITLI, açık pencere BEKLIYOR", () => {
    expect(gelisimDurumu(false, kapali)).toBe("KILITLI");
    expect(gelisimDurumu(false, acik)).toBe("BEKLIYOR");
  });
});

describe("gelisimCevaplariCozumle", () => {
  const gecerli = {
    anahtar: "duygu-tanima",
    kategori: "Duygusal Gelişim Alanları",
    baslik: "Duygu Tanıma ve İfade Etme",
    soruMetni: "Çocuk, kendi duygularını tanıyabiliyor mu?",
    deger: 4,
  };

  it("geçerli satırları olduğu gibi döndürür (null = Değerlendirilemedi dahil)", () => {
    const sonuc = gelisimCevaplariCozumle([gecerli, { ...gecerli, deger: null }]);
    expect(sonuc).toHaveLength(2);
    expect(sonuc[1].deger).toBeNull();
  });

  it("dizi olmayan gövdeyi ve bozuk satırları sessizce atlar", () => {
    expect(gelisimCevaplariCozumle("bozuk")).toEqual([]);
    expect(gelisimCevaplariCozumle(null)).toEqual([]);
    expect(
      gelisimCevaplariCozumle([gecerli, { anahtar: 42 }, "metin", null]),
    ).toEqual([gecerli]);
  });
});
