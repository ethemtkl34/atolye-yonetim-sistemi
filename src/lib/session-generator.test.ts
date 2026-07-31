import { describe, expect, it } from "vitest";
import {
  donemOturumlariniUret,
  kulupOturumlariniUret,
  mevcutHaftaNumarasi,
  type HaftaGirdisi,
} from "./session-generator";
import { tarihCozumle, tarihMetni } from "./tarih";

/** 17 Ekim 2026 cumartesisinden başlayan 10 ardışık hafta sonu. */
const HAFTALAR: HaftaGirdisi[] = Array.from({ length: 10 }, (_, i) => ({
  id: `hafta-${i + 1}`,
  weekNumber: i + 1,
  date: new Date(Date.UTC(2026, 9, 17 + i * 7)),
}));

const BES_ATOLYE = ["a1", "a2", "a3", "a4", "a5"];

describe("donemOturumlariniUret", () => {
  it("baştan açılan grup için 10 hafta × 5 atölye = 50 oturum üretir", () => {
    // §13.1 ve §13.2 — dönem 10 hafta, her eğitim gününde 5 atölye.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunu: "CUMARTESI",
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
      grupGunu: "CUMARTESI",
      baslangicHaftasi: 4,
    });

    expect(oturumlar).toHaveLength(35);
  });

  it("geçmiş haftalara ait hiç oturum üretmez", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunu: "CUMARTESI",
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
      grupGunu: "PAZAR",
      baslangicHaftasi: 10,
    });

    expect(oturumlar).toHaveLength(5);
  });

  it("cumartesi grubu haftanın cumartesisinde toplanır", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR.slice(0, 1),
      atolyeIdleri: ["a1"],
      grupGunu: "CUMARTESI",
      baslangicHaftasi: 1,
    });

    expect(tarihMetni(oturumlar[0].date)).toBe("2026-10-17");
  });

  it("pazar grubu aynı haftanın ertesi gününde toplanır", () => {
    // Aynı dönemde cumartesi ve pazar grupları olabildiği için hafta tek bir
    // çapa tarihle saklanır; grubun günü tarihi belirler.
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR.slice(0, 1),
      atolyeIdleri: ["a1"],
      grupGunu: "PAZAR",
      baslangicHaftasi: 1,
    });

    expect(tarihMetni(oturumlar[0].date)).toBe("2026-10-18");
  });

  it("her hafta için her atölyeden tam olarak bir oturum üretir", () => {
    const oturumlar = donemOturumlariniUret({
      haftalar: HAFTALAR,
      atolyeIdleri: BES_ATOLYE,
      grupGunu: "CUMARTESI",
      baslangicHaftasi: 1,
    });

    // Aynı hafta + aynı atölye ikinci kez üretilmemeli; veritabanındaki
    // benzersizlik kısıtı da bunu bekliyor.
    const anahtarlar = oturumlar.map((o) => `${o.termWeekId}|${o.workshopTypeId}`);
    expect(new Set(anahtarlar).size).toBe(50);
  });
});

describe("kulupOturumlariniUret", () => {
  it("3 atölye için 3 oturum üretir ve hafta bağı kurmaz", () => {
    // §13.6 — Kulüp tek yarım gün, 3 atölye.
    const oturumlar = kulupOturumlariniUret({
      tarih: new Date(Date.UTC(2026, 10, 7)),
      atolyeIdleri: ["a1", "a2", "a3"],
    });

    expect(oturumlar).toHaveLength(3);
    expect(oturumlar.every((o) => o.termWeekId === null)).toBe(true);
    expect(oturumlar.every((o) => tarihMetni(o.date) === "2026-11-07")).toBe(
      true,
    );
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
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, "PAZAR")).toBe(2);
    // Cumartesi grubu için aynı gün gerçekten geçmiştir; 3. hafta doğru.
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, "CUMARTESI")).toBe(3);
  });

  it("son haftanın pazarında pazar grubu hâlâ açılabilir", () => {
    // 10. haftanın pazarı: cumartesi grubuna oturum kalmadı (null), pazar
    // grubu o günkü 5 oturumu alabilir.
    const bugun = tarihCozumle("2026-12-20")!;
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, "CUMARTESI")).toBeNull();
    expect(mevcutHaftaNumarasi(HAFTALAR, bugun, "PAZAR")).toBe(10);
  });
});
