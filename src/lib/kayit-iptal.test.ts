import { describe, expect, it } from "vitest";
import {
  IPTAL_SEBEPLERI,
  IPTAL_SEBEP_SIRASI,
  atolyeOzeti,
  ayrilmaMetni,
} from "./kayit-iptal";

const gun = (metin: string) => new Date(`${metin}T00:00:00.000Z`);

describe("ayrilmaMetni", () => {
  it("hiç katılmadan ayrılan kaydı ayırt eder", () => {
    expect(ayrilmaMetni({ lastAttendedWeek: null, lastAttendedDate: null })).toBe(
      "Hiç katılmadan ayrıldı",
    );
    // Hafta numarası dolu ama gün boşsa da katılım yok: cümle güne bakıyor.
    expect(ayrilmaMetni({ lastAttendedWeek: 3, lastAttendedDate: null })).toBe(
      "Hiç katılmadan ayrıldı",
    );
  });

  it("hafta numarası olmayan katılımı telafi günü sayar", () => {
    expect(
      ayrilmaMetni({ lastAttendedWeek: null, lastAttendedDate: gun("2026-10-18") }),
    ).toBe("Son katıldığı gün 18 Ekim 2026 (telafi günü)");
  });

  it("normal haftada ayrılmayı hafta numarasıyla yazar", () => {
    expect(
      ayrilmaMetni({ lastAttendedWeek: 4, lastAttendedDate: gun("2026-10-18") }),
    ).toBe("4. haftada ayrıldı · son katıldığı gün 18 Ekim 2026");
  });

  it("tarihi UTC'den okur — yerel saat dilimi günü kaydırmaz", () => {
    // Tarihler veritabanında UTC gece yarısına sabitli. Yerel saatle
    // biçimlenseydi Türkiye'de (UTC+3) sorun çıkmazdı ama negatif dilimli
    // bir sunucuda gün bir geri kayardı.
    expect(
      ayrilmaMetni({ lastAttendedWeek: 1, lastAttendedDate: gun("2026-01-01") }),
    ).toContain("1 Ocak 2026");
  });
});

describe("atolyeOzeti", () => {
  it("oturumu olmayan grupta sayı vermez", () => {
    expect(atolyeOzeti(0, 0)).toBe("Bu grupta henüz atölye oturumu yok.");
  });

  it("tamamlanan ve kaçırılan sayısını birlikte yazar", () => {
    expect(atolyeOzeti(7, 10)).toBe(
      "10 atölyeden 7 tanesini tamamladı, 3 tanesine katılamadı.",
    );
  });

  it("hepsini tamamlayanda kaçırılan sıfır", () => {
    expect(atolyeOzeti(10, 10)).toContain("0 tanesine katılamadı");
  });

  it("tamamlanan toplamı aşarsa eksi sayı yazmaz", () => {
    // Telafiye katılan öğrencide `tamamlanan` grubun oturum sayısını
    // geçebiliyor; "-2 tanesine katılamadı" cümlesi kurulmamalı.
    expect(atolyeOzeti(12, 10)).toBe(
      "10 atölyeden 12 tanesini tamamladı, 0 tanesine katılamadı.",
    );
  });
});

describe("iptal sebepleri", () => {
  it("sıra listesi bütün sebepleri tam bir kez içerir", () => {
    // Listeden düşen bir sebep seçim kutusunda hiç görünmez; iki kez
    // yazılanı ise kullanıcı iki satır olarak görür.
    expect([...IPTAL_SEBEP_SIRASI].sort()).toEqual(
      Object.keys(IPTAL_SEBEPLERI).sort(),
    );
  });
});
