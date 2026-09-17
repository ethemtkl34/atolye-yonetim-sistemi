import type { Role } from "@/generated/prisma/enums";

/**
 * §17.4 — Geçmiş randevu kilidi (Eylül 2026 kararı).
 *
 * Günü BİTMİŞ bir randevunun saati, uzmanı, hizmeti, ücreti değiştirilemez ve
 * iptal edilemez; yalnız Kurum ve Şube Yöneticisi değiştirebilir. Gerekçe:
 * geçmiş haftanın cirosu ve seans sayısı raporlandıktan sonra sessizce
 * değişmemeli. "Gerçekleşti / Gelmedi" işaretlemesi ise HERKESE açık kalır —
 * seansın sonucu çoğu zaman ertesi gün işaretleniyor.
 *
 * Kilit anı "gün bitince": bugünün randevuları gece yarısına kadar serbest,
 * gün içi saat kaydırmaları masada kalıyor.
 *
 * SAAT SÖZLEŞMESİ: randevu saatleri duvar saati olarak UTC alanlarında
 * tutuluyor (14:00 randevusu `14:00Z`, bkz. `lib/tarih.ts`). "Bugün" de aynı
 * çapada olmalı ama İSTANBUL takvimine göre: `bugun()` UTC tarihini veriyor ve
 * gece 00:00–03:00 arasında hâlâ dünü gösterirdi — dünün randevuları üç saat
 * fazladan açık kalırdı.
 */

const ISTANBUL_TARIHI = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** İstanbul'daki bugünün tarihi, randevu saatleriyle aynı çapada (UTC gece yarısı). */
export function istanbulBugunu(simdi: Date = new Date()): Date {
  const [yil, ay, gun] = ISTANBUL_TARIHI.format(simdi).split("-").map(Number);
  return new Date(Date.UTC(yil, ay - 1, gun));
}

/** Randevunun günü bitti mi — dünkü ve daha eski randevular `true`. */
export function randevuGecmisMi(baslangic: Date, simdi: Date = new Date()): boolean {
  return baslangic.getTime() < istanbulBugunu(simdi).getTime();
}

/** Geçmiş randevuyu değiştirebilen roller: Kurum ve Şube Yöneticisi. */
export function gecmisRandevuyuDuzenleyebilirMi(roller: readonly Role[]): boolean {
  return roller.includes("ADMIN") || roller.includes("SUBE_YONETICISI");
}

export const GECMIS_KILIDI_MESAJI =
  "Geçmiş tarihli randevuyu yalnız Kurum ve Şube Yöneticisi değiştirebilir. Seansın sonucunu \"Gerçekleşti\" ya da \"Gelmedi\" olarak işaretleyebilirsiniz.";

export const GECMIS_TARIH_MESAJI =
  "Geçmiş bir tarihe randevu yalnız Kurum ve Şube Yöneticisi tarafından girilebilir.";
