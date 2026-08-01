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
 * İzin verilen durum geçişleri.
 *
 * Her durumdan her duruma geçilebilseydi arşivden çıkan bir program tek
 * hamlede yeniden kayıt almaya başlayabilir ("Arşivlendi" → "Kayıt alıyor")
 * veya tamamlanmış bir dönem taslağa dönebilirdi. Geri alma yolları bilerek
 * korunuyor (arşivden çıkma, erken kapatmayı geri alma) ama kapalı bir
 * programı yeniden açmak en az iki bilinçli adım gerektiriyor.
 */
export const DONEM_DURUM_GECISLERI: Record<TermStatus, TermStatus[]> = {
  TASLAK: ["KAYIT_ALIYOR", "ARSIVLENDI"],
  KAYIT_ALIYOR: ["TASLAK", "DEVAM_EDIYOR", "TAMAMLANDI", "ARSIVLENDI"],
  DEVAM_EDIYOR: ["KAYIT_ALIYOR", "TAMAMLANDI", "ARSIVLENDI"],
  TAMAMLANDI: ["DEVAM_EDIYOR", "ARSIVLENDI"],
  ARSIVLENDI: ["TAMAMLANDI"],
};

export const KULUP_DURUM_GECISLERI: Record<ClubStatus, ClubStatus[]> = {
  TASLAK: ["KAYIT_ALIYOR", "IPTAL_EDILDI", "ARSIVLENDI"],
  KAYIT_ALIYOR: ["TASLAK", "TAMAMLANDI", "IPTAL_EDILDI", "ARSIVLENDI"],
  TAMAMLANDI: ["KAYIT_ALIYOR", "ARSIVLENDI"],
  IPTAL_EDILDI: ["KAYIT_ALIYOR", "ARSIVLENDI"],
  ARSIVLENDI: ["TAMAMLANDI", "IPTAL_EDILDI"],
};

/**
 * Dashboard kartlarıyla liste ekranlarının paylaştığı sorgu koşulları.
 *
 * P11'in kabul ölçütü "dashboard sayıları listelerle birebir uyuşur". Bunu
 * ancak iki ekran gerçekten aynı koşulu okursa garanti edebiliriz; koşulu iki
 * yere ayrı ayrı yazmak, sonradan biri değişince sessizce ayrışır. Bu yüzden
 * kart da liste de aşağıdaki koşulları kullanır — artık AKTİF ŞUBE içinde.
 *
 * Dönem ve kulüp ORTAK olduğu için onların koşulları sabit kaldı; şubeye ait
 * olan grup, öğrenci ve kayıt koşulları ise şube kimliği alan fonksiyonlara
 * dönüştü. Sabit bırakılsalardı şube süzgeci çağrı yerlerinde tek tek elle
 * yazılırdı ve biri unutulduğunda sessizce sızıntı olurdu; fonksiyon olunca
 * şube vermeden çağrılamıyorlar.
 */
export const AKTIF_DONEM_KOSULU = {
  status: { in: AKTIF_DONEM_DURUMLARI },
} satisfies Prisma.TermWhereInput;

export const AKTIF_KULUP_KOSULU = {
  status: { in: AKTIF_KULUP_DURUMLARI },
} satisfies Prisma.ClubWhereInput;

/** Şubenin açık ve aktif bir programa bağlı grupları. */
export function aktifGrupKosulu(subeId: string): Prisma.GroupWhereInput {
  return {
    branchId: subeId,
    active: true,
    OR: [{ term: AKTIF_DONEM_KOSULU }, { club: AKTIF_KULUP_KOSULU }],
  };
}

/**
 * §12.1 "Toplam aktif öğrenci" — aktif bir programda aktif kaydı olan öğrenci.
 * Aynı öğrencinin iki kaydı varsa bir kez sayılır.
 */
export function aktifOgrenciKosulu(subeId: string): Prisma.StudentWhereInput {
  return {
    branchId: subeId,
    enrollments: {
      some: { status: "AKTIF", group: aktifGrupKosulu(subeId) },
    },
  };
}

/**
 * Sorumlu stajyeri olmayan, aktif programdaki aktif kayıt.
 *
 * Bu kaydın formlarını dolduracak kimse yok: stajyer görev listeleri
 * `internId` üzerinden çalışır, atanmamış kayıt hiçbir stajyerin ekranında
 * görünmez. Dashboard kartı ile kayıtlar ekranının "Atanmamış" süzgeci aynı
 * koşulu okur.
 */
export function atanmamisKayitKosulu(
  subeId: string,
): Prisma.EnrollmentWhereInput {
  return {
    status: "AKTIF",
    internId: null,
    group: aktifGrupKosulu(subeId),
  };
}

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
