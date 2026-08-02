import type { CancelReason } from "@/generated/prisma/enums";
import { tarihBicimle } from "@/lib/tarih";

/**
 * Kayıt iptalinin arayüzdeki karşılıkları.
 *
 * Sebep serbest metin değil etiket: "bu dönem kaç çocuk taşındığı için
 * ayrıldı" sorusu ancak sayılabilir bir alandan cevaplanır. Açıklama alanı
 * etiketin yerine değil, yanına yazılıyor.
 */

export const IPTAL_SEBEPLERI: Record<CancelReason, string> = {
  TASINMA: "Taşınma",
  SAGLIK: "Sağlık",
  AILEVI: "Ailevi sebepler",
  DEVAMSIZLIK: "Devamsızlık",
  DIGER: "Diğer",
};

/** Seçim listesindeki sıra — sık kullanılan sebep üstte. */
export const IPTAL_SEBEP_SIRASI: CancelReason[] = [
  "TASINMA",
  "SAGLIK",
  "AILEVI",
  "DEVAMSIZLIK",
  "DIGER",
];

export type AyrilmaBilgisi = {
  lastAttendedWeek: number | null;
  lastAttendedDate: Date | null;
};

/**
 * "Kaçıncı haftada ayrıldı" cümlesi.
 *
 * Üç durum var ve üçü de farklı okunur (bkz. şemadaki alan açıklaması):
 * hiç katılmadan ayrılma, telafi günü, normal hafta.
 */
export function ayrilmaMetni(kayit: AyrilmaBilgisi): string | null {
  if (!kayit.lastAttendedDate) return "Hiç katılmadan ayrıldı";

  const gun = tarihBicimle(kayit.lastAttendedDate);
  if (kayit.lastAttendedWeek === null) {
    return `Son katıldığı gün ${gun} (telafi günü)`;
  }
  return `${kayit.lastAttendedWeek}. haftada ayrıldı · son katıldığı gün ${gun}`;
}

/**
 * Atölye özeti — TÜRETİLİR, saklanmaz.
 *
 * Hangi atölyeye katıldığı zaten `Score` satırlarında duruyor; iptal anında
 * ikinci bir kopya çıkarmak iki kaynak ve çelişki riski demekti. `tamamlanan`
 * katılım işaretli puanlama sayısı, `toplam` grubun oturum sayısıdır.
 */
export function atolyeOzeti(tamamlanan: number, toplam: number): string {
  if (toplam === 0) return "Bu grupta henüz atölye oturumu yok.";
  const kacirilan = Math.max(0, toplam - tamamlanan);
  return `${toplam} atölyeden ${tamamlanan} tanesini tamamladı, ${kacirilan} tanesine katılamadı.`;
}
