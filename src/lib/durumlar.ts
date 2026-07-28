import type { Prisma } from "@/generated/prisma/client";
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

/**
 * Aktif sayılan kulüp durumu. Kulüp tek yarım gün sürdüğü için "devam ediyor"
 * karşılığı yok; kayıt alan kulüp aktiftir.
 */
export const AKTIF_KULUP_DURUMLARI: ClubStatus[] = ["KAYIT_ALIYOR"];

/**
 * Dashboard kartlarıyla liste ekranlarının paylaştığı sorgu koşulları.
 *
 * P11'in kabul ölçütü "dashboard sayıları listelerle birebir uyuşur". Bunu
 * ancak iki ekran gerçekten aynı koşulu okursa garanti edebiliriz; koşulu iki
 * yere ayrı ayrı yazmak, sonradan biri değişince sessizce ayrışır. Bu yüzden
 * kart da liste de aşağıdaki nesneleri kullanır.
 */
export const AKTIF_DONEM_KOSULU = {
  status: { in: AKTIF_DONEM_DURUMLARI },
} satisfies Prisma.TermWhereInput;

export const AKTIF_KULUP_KOSULU = {
  status: { in: AKTIF_KULUP_DURUMLARI },
} satisfies Prisma.ClubWhereInput;

/** Açık ve aktif bir programa bağlı gruplar. */
export const AKTIF_GRUP_KOSULU = {
  active: true,
  OR: [{ term: AKTIF_DONEM_KOSULU }, { club: AKTIF_KULUP_KOSULU }],
} satisfies Prisma.GroupWhereInput;

/**
 * §12.1 "Toplam aktif öğrenci" — aktif bir programda aktif kaydı olan öğrenci.
 * Aynı öğrencinin iki kaydı varsa bir kez sayılır.
 */
export const AKTIF_OGRENCI_KOSULU = {
  enrollments: { some: { status: "AKTIF", group: AKTIF_GRUP_KOSULU } },
} satisfies Prisma.StudentWhereInput;

/**
 * §12.2 — Arşiv, arşivlenmiş programların tek adresi. Dönem ve kulüp
 * listeleri tam olarak bu koşulun dışında kalanları gösterir; böylece her
 * program tam olarak bir listede görünür, hiçbiri iki yerde çıkmaz.
 */
export const ARSIV_DONEM_KOSULU = {
  status: "ARSIVLENDI",
} satisfies Prisma.TermWhereInput;

export const ARSIV_KULUP_KOSULU = {
  status: "ARSIVLENDI",
} satisfies Prisma.ClubWhereInput;
