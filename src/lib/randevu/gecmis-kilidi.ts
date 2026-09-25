/**
 * §17.4 — Randevunun günü bitti mi.
 *
 * ESKİ KARAR KALDIRILDI (25 Eylül 2026). Eylül başında "günü bitmiş randevuyu
 * yalnız Kurum ve Şube Yöneticisi değiştirebilir" kuralı vardı; gerekçe
 * raporlanmış geçmiş haftanın cirosunun sessizce değişmemesiydi. Pratikte
 * takvimi kuran danışma masası dünkü seansı hiç giremiyor, her düzeltme için
 * yönetici bekliyordu — kurum kuralı kaldırdı. Artık `randevular` modülünde
 * TAM yetkisi olan HERKES geçmiş tarihe randevu açar, geçmiş randevuyu
 * düzenler ve iptal eder; geriye dönük bir gün sınırı da yok.
 *
 * Buradan geriye kalan tek şey "bu randevunun günü bitti mi" sorusu. Tek
 * tüketicisi SİLME kuralı (`randevuSil`): günü geçmiş randevu silinmez,
 * iptal edilir. Silme kaydı ortadan kaldırır ve ciroya girmiş bir seansın
 * izi kalmaz; iptal ise görünür bir karar olarak durur. Bu ayrım yöneticide
 * de geçerli ve kaldırılmadı.
 *
 * SAAT SÖZLEŞMESİ: randevu saatleri duvar saati olarak UTC alanlarında
 * tutuluyor (14:00 randevusu `14:00Z`, bkz. `lib/tarih.ts`). "Bugün" de aynı
 * çapada olmalı ama İSTANBUL takvimine göre: `bugun()` UTC tarihini veriyor ve
 * gece 00:00–03:00 arasında hâlâ dünü gösterirdi — dünün randevuları üç saat
 * fazladan silinebilir kalırdı.
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
