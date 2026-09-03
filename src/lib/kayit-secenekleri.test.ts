import { describe, expect, it } from "vitest";
import { grupSecenekleri } from "./kayit-secenekleri";
import type { Day } from "@/generated/prisma/enums";

const grup = (ustuneYaz: Partial<Parameters<typeof grupSecenekleri>[0][0]> = {}) => ({
  id: "g1",
  name: "A Grubu",
  days: ["CUMARTESI"] as Day[],
  timeSlot: "OGLEDEN_ONCE" as const,
  capacity: 12,
  active: true,
  startWeekNumber: 1,
  _count: { sessions: 10, enrollments: 5 },
  ...ustuneYaz,
});

describe("grupSecenekleri", () => {
  it("kontenjanı kayıt sayısından hesaplar", () => {
    const [secenek] = grupSecenekleri([grup()]);
    expect(secenek.kapasite).toBe(12);
    expect(secenek.doluluk).toBe(5);
    expect(secenek.dolu).toBe(false);
  });

  it("kontenjan dolduğunda dolu işaretler", () => {
    const [secenek] = grupSecenekleri([
      grup({ _count: { sessions: 10, enrollments: 12 } }),
    ]);
    expect(secenek.dolu).toBe(true);
  });

  it("kontenjanın üstündeki kayıt da dolu sayılır", () => {
    // Koordinatör uyarıyı geçip kontenjan üstüne kayıt açabiliyor;
    // "12/12" değil "13/12" görünen grup yine de dolu.
    const [secenek] = grupSecenekleri([
      grup({ _count: { sessions: 10, enrollments: 13 } }),
    ]);
    expect(secenek.dolu).toBe(true);
    expect(secenek.doluluk).toBe(13);
  });

  it("gün ve zaman dilimini okunur metne çevirir", () => {
    const [secenek] = grupSecenekleri([grup()]);
    expect(secenek.zaman).toBe("Cumartesi öğleden önce");
  });

  it("çok günlü grubun günlerini haftanın sırasıyla yazar", () => {
    // Kaynak dizi ters gelse bile metin "Cumartesi, Pazar" olmalı.
    const [secenek] = grupSecenekleri([
      grup({
        days: ["PAZAR", "CUMARTESI"] as Day[],
        timeSlot: "OGLEDEN_SONRA",
      }),
    ]);
    expect(secenek.zaman).toBe("Cumartesi, Pazar öğleden sonra");
  });

  it("pasif grubu listeden atmaz, işaretler", () => {
    // Kapatılmış grup seçilemez ama görünmeli: mevcut kayıtları orada.
    const [secenek] = grupSecenekleri([grup({ active: false })]);
    expect(secenek.aktif).toBe(false);
  });

  it("başlangıç haftası ve oturum sayısını taşır", () => {
    // Dönem ortasında açılan grup geçmiş haftaları telafi etmiyor;
    // kayıt ekranı bunu bu iki alandan gösteriyor.
    const [secenek] = grupSecenekleri([
      grup({ startWeekNumber: 4, _count: { sessions: 7, enrollments: 0 } }),
    ]);
    expect(secenek.baslangicHaftasi).toBe(4);
    expect(secenek.oturumSayisi).toBe(7);
  });

  it("boş listede boş liste döner", () => {
    expect(grupSecenekleri([])).toEqual([]);
  });

  it("grupların sırasını korur", () => {
    const secenekler = grupSecenekleri([
      grup({ id: "g1", name: "A" }),
      grup({ id: "g2", name: "B" }),
    ]);
    expect(secenekler.map((s) => s.id)).toEqual(["g1", "g2"]);
  });
});
