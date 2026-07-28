import type { ClubStatus, TermStatus } from "@/generated/prisma/enums";

/** §4.3 ve §5.3 — durum kodlarının arayüzdeki karşılıkları. */

type RozetTuru = "notr" | "olumlu" | "uyari" | "pasif";

export const DONEM_DURUMLARI: Record<
  TermStatus,
  { etiket: string; rozet: RozetTuru }
> = {
  TASLAK: { etiket: "Taslak", rozet: "notr" },
  KAYIT_ALIYOR: { etiket: "Kayıt alıyor", rozet: "olumlu" },
  DEVAM_EDIYOR: { etiket: "Devam ediyor", rozet: "olumlu" },
  TAMAMLANDI: { etiket: "Tamamlandı", rozet: "notr" },
  ARSIVLENDI: { etiket: "Arşivlendi", rozet: "pasif" },
};

export const KULUP_DURUMLARI: Record<
  ClubStatus,
  { etiket: string; rozet: RozetTuru }
> = {
  TASLAK: { etiket: "Taslak", rozet: "notr" },
  KAYIT_ALIYOR: { etiket: "Kayıt alıyor", rozet: "olumlu" },
  TAMAMLANDI: { etiket: "Tamamlandı", rozet: "notr" },
  IPTAL_EDILDI: { etiket: "İptal edildi", rozet: "uyari" },
  ARSIVLENDI: { etiket: "Arşivlendi", rozet: "pasif" },
};

/** Aktif sayılan dönem durumları — dashboard ve listelerde kullanılır. */
export const AKTIF_DONEM_DURUMLARI: TermStatus[] = [
  "KAYIT_ALIYOR",
  "DEVAM_EDIYOR",
];
