import { describe, expect, it } from "vitest";
import {
  donemOturumlariniUret,
  kulupOturumlariniUret,
  mevcutHaftaNumarasi,
  type HaftaGirdisi,
} from "./oturum-uretici";
import { tarihCozumle, tarihMetni } from "./tarih";

/**
 * 12 Ekim 2026 pazartesisinden başlayan 10 ardışık hafta.
 *
 * Çapa haftanın PAZARTESİ'si; o haftanın cumartesisi 17 Ekim, pazarı 18 Ekim.
 * Testlerdeki toplanma tarihleri bu yüzden çapa eskiden cumartesiyken
 * bekleneni ile aynı kalıyor.
 */
const HAFTALAR: HaftaGirdisi[] = Array.from({ length: 10 }, (_, i) => ({
  id: `hafta-${i + 1}`,
  weekNumber: i + 1,
  date: new Date(Date.UTC(2026, 9, 12 + i * 7)),
}));

const BES_ATOLYE = ["a1", "a2", "a3", "a4", "a5"];

describe("donemOturumlariniUret", () => {
  it("baştan açılan grup için 10 hafta × 5 atölye = 50 oturum üretir", () => {
    // §13.1 ve §13.2 — dönem 10 hafta, her eğitim gününde 5 atölye.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunleri: ["CUMARTESI"],
      baslangicHaftasi: 1,
    });

    expect(oturumlar).toHaveLength(50);
  });

  it("4. haftada açılan grup için 35 oturum üretir, 50 değil", () => {
    // §13.5 — Sonradan açılan grup geçmiş haftaları telafi etmez.
    // 4–10 arası 7 hafta × 5 atölye = 35.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunleri: ["CUMARTESI"],
      baslangicHaftasi: 4,
    });

    expect(oturumlar).toHaveLength(35);
  });

  it("geçmiş haftalara ait hiç oturum üretmez", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunleri: ["CUMARTESI"],
      baslangicHaftasi: 4,
    });

    const haftaIdleri = new Set(oturumlar.map((o) => o.termWeekId));
    expect(haftaIdleri.has("hafta-1")).toBe(false);
    expect(haftaIdleri.has("hafta-3")).toBe(false);
    expect(haftaIdleri.has("hafta-4")).toBe(true);
    expect(haftaIdleri.has("hafta-10")).toBe(true);
  });

  it("son haftada açılan grup yalnızca 5 oturum alır", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunleri: ["PAZAR"],
      baslangicHaftasi: 10,
    });

    expect(oturumlar).toHaveLength(5);
  });

  it("cumartesi grubu haftanın cumartesisinde toplanır", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR.slice(0, 1),
      atolyeIdleri: ["a1"],
      grupGunleri: ["CUMARTESI"],
      baslangicHaftasi: 1,
    });

    expect(tarihMetni(oturumlar[0].date)).toBe("2026-10-17");
  });

  it("pazar grubu aynı haftanın ertesi gününde toplanır", () => {
    // Aynı dönemde farklı günlerde toplanan gruplar olabildiği için hafta tek
    // bir çapa tarihle saklanır; grubun günü tarihi belirler.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR.slice(0, 1),
      atolyeIdleri: ["a1"],
      grupGunleri: ["PAZAR"],
      baslangicHaftasi: 1,
    });

    expect(tarihMetni(oturumlar[0].date)).toBe("2026-10-18");
  });

  it("çok günlü grupta her toplanma gününde bütün atölyeler yapılır", () => {
    // Yaz programları hafta içi ve haftada birden çok gün yürüyor. Gün sayısı
    // oturum sayısını ÇARPAR: 10 hafta × 3 gün × 5 atölye = 150.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunleri: ["PAZARTESI", "CARSAMBA", "CUMA"],
      baslangicHaftasi: 1,
    });

    expect(oturumlar).toHaveLength(150);

    // İlk haftanın günleri: 12, 14, 16 Ekim 2026.
    const ilkHafta = oturumlar.filter((o) => o.termWeekId === "hafta-1");
    const gunler = [...new Set(ilkHafta.map((o) => tarihMetni(o.date)))];
    expect(gunler).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);

    // Her gün 5 atölyenin tamamını alır.
    for (const gun of gunler) {
      expect(ilkHafta.filter((o) => tarihMetni(o.date) === gun)).toHaveLength(5);
    }
  });

  it("günler takvim sırasına dizilir", () => {
    // Koordinatör kutuları ters sırayla işaretlese de üretim sırası aynı.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR.slice(0, 1),
      atolyeIdleri: ["a1"],
      grupGunleri: ["CUMA", "PAZARTESI"],
      baslangicHaftasi: 1,
    });

    expect(oturumlar.map((o) => tarihMetni(o.date))).toEqual([
      "2026-10-12",
      "2026-10-16",
    ]);
  });

  it("her hafta için her atölyeden tam olarak bir oturum üretir", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunleri: ["CUMARTESI"],
      baslangicHaftasi: 1,
    });

    // Aynı hafta + aynı atölye ikinci kez üretilmemeli; veritabanındaki
    // benzersizlik kısıtı da bunu bekliyor.
    const anahtarlar = oturumlar.map((o) => `${o.termWeekId}|${o.workshopTypeId}`);
    expect(new Set(anahtarlar).size).toBe(50);
  });
});

describe("kulupOturumlariniUret", () => {
  it("tek günlük kulüpte 3 atölye için 3 oturum üretir", () => {
    const oturumlar = kulupOturumlariniUret({
      tarihler: [new Date(Date.UTC(2026, 10, 7))],
      atolyeIdleri: ["a1", "a2", "a3"],
    });

    expect(oturumlar).toHaveLength(3);
    // Kulübün `TermWeek` kaydı yok; hafta numarası oturumun kendi alanında.
    expect(oturumlar.every((o) => o.termWeekId === null)).toBe(true);
    expect(oturumlar.every((o) => o.weekNumber === 1)).toBe(true);
    expect(oturumlar.every((o) => tarihMetni(o.date) === "2026-11-07")).toBe(
      true,
    );
  });

  it("çok haftalı kulüpte her güne bütün atölyeleri yazar", () => {
    const oturumlar = kulupOturumlariniUret({
      tarihler: [
        new Date(Date.UTC(2026, 10, 14)),
        new Date(Date.UTC(2026, 10, 7)),
        new Date(Date.UTC(2026, 10, 21)),
      ],
      atolyeIdleri: ["a1", "a2", "a3"],
    });

    expect(oturumlar).toHaveLength(9);

    // Tarihler sıralanıyor: hafta numarası girilme sırasına değil TAKVİME
    // göre verilmeli, yoksa "2. hafta" 1. haftadan önce gelebilir.
    const gunler = [...new Set(oturumlar.map((o) => tarihMetni(o.date)))];
    expect(gunler).toEqual(["2026-11-07", "2026-11-14", "2026-11-21"]);

    const ilkGun = oturumlar.filter((o) => tarihMetni(o.date) === "2026-11-07");
    expect(ilkGun.every((o) => o.weekNumber === 1)).toBe(true);

    const sonGun = oturumlar.filter((o) => tarihMetni(o.date) === "2026-11-21");
    expect(sonGun.every((o) => o.weekNumber === 3)).toBe(true);
  });
});

describe("mevcutHaftaNumarasi", () => {
  it("dönem başlamadıysa 1 döner", () => {
    const bugun = tarihCozumle("2026-10-01")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun)).toBe(1);
  });

  it("dönem ortasında yaklaşan ilk haftayı döner", () => {
    // 3. hafta 31 Ekim; 28 Ekim'de açılan grup 3. haftadan başlar.
    const bugun = tarihCozumle("2026-10-28")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun)).toBe(3);
  });

  it("hafta gününde açılan grup o haftaya dahil olur", () => {
    // Tam 2. haftanın cumartesisi: o hafta hâlâ yapılacak sayılır.
    const bugun = tarihCozumle("2026-10-24")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun)).toBe(2);
  });

  it("dönem bittiyse null döner", () => {
    const bugun = tarihCozumle("2027-01-01")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun)).toBeNull();
  });

  it("pazar günü açılan pazar grubu o haftayı kaybetmez", () => {
    // 2. haftanın pazarı (25 Ekim): pazar grubunun o haftaki oturumu henüz
    // yapılmadı — grup 2. haftadan başlamalı. Çapaya (cumartesiye) bakılsaydı
    // hafta geçmiş sayılır ve 5 oturum sessizce kaybolurdu.
    const bugun = tarihCozumle("2026-10-25")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, ["PAZAR"])).toBe(2);
    // Cumartesi grubu için aynı gün gerçekten geçmiştir; 3. hafta doğru.
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, ["CUMARTESI"])).toBe(3);
  });

  it("son haftanın pazarında pazar grubu hâlâ açılabilir", () => {
    // 10. haftanın pazarı: cumartesi grubuna oturum kalmadı (null), pazar
    // grubu o günkü 5 oturumu alabilir.
    const bugun = tarihCozumle("2026-12-20")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, ["CUMARTESI"])).toBeNull();
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, ["PAZAR"])).toBe(10);
  });
});
