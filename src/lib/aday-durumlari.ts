import type { Prisma } from "@/generated/prisma/client";
import type {
  LeadActivityType,
  LeadLossReason,
  LeadSource,
  LeadStage,
} from "@/generated/prisma/enums";

/**
 * §16 — Aday (CRM) boru hattının tek kaynağı: etiketler, izinli geçişler ve
 * ekranların paylaştığı sorgu koşulları.
 *
 * `durumlar.ts` ile aynı sözleşme: dashboard kartı ile liste süzgeci AYNI
 * koşul fonksiyonunu okur; koşul iki yere ayrı yazılsaydı biri değişince
 * sessizce ayrışırdı. Şubeye ait koşullar şube kimliği almadan çağrılamaz.
 */

type RozetTuru = "notr" | "olumlu" | "uyari" | "pasif";

export const ADAY_ASAMALARI: Record<
  LeadStage,
  { etiket: string; rozet: RozetTuru }
> = {
  YENI: { etiket: "Yeni", rozet: "notr" },
  ULASILDI: { etiket: "Ulaşıldı", rozet: "olumlu" },
  RANDEVU_VERILDI: { etiket: "Randevu verildi", rozet: "olumlu" },
  GORUSME_YAPILDI: { etiket: "Görüşme yapıldı", rozet: "olumlu" },
  KAZANILDI: { etiket: "Kazanıldı", rozet: "olumlu" },
  KAYBEDILDI: { etiket: "Kaybedildi", rozet: "uyari" },
};

/** Boru hattı hâlâ açık — aday üzerinde çalışılıyor. */
export const ACIK_ASAMALAR: LeadStage[] = [
  "YENI",
  "ULASILDI",
  "RANDEVU_VERILDI",
  "GORUSME_YAPILDI",
];

/**
 * İzin verilen aşama geçişleri (dönem/kulüp durumlarındaki desen).
 *
 * KAZANILDI her açık aşamadan erişilir — yoldan gelen aile aynı gün kayıt
 * olabilir, dönüşümü aşama tırmanışına zorlamak amaca ters — ama YALNIZCA
 * dönüşüm akışıyla yazılır (`asamaDegistir` bu hedefi reddeder) ve
 * terminaldir: öğrenci artık var, geri almak bilinçli bir yönetici işi olur.
 * KAYBEDILDI de her açık aşamadan; geri dönüşü tek adım (YENI) — yanlışlıkla
 * kapatmanın telafisi. Komşu geri adımlar düzeltme yolu olarak açık.
 */
export const ADAY_ASAMA_GECISLERI: Record<LeadStage, LeadStage[]> = {
  YENI: ["ULASILDI", "KAZANILDI", "KAYBEDILDI"],
  ULASILDI: [
    "YENI",
    "RANDEVU_VERILDI",
    "GORUSME_YAPILDI",
    "KAZANILDI",
    "KAYBEDILDI",
  ],
  RANDEVU_VERILDI: ["ULASILDI", "GORUSME_YAPILDI", "KAZANILDI", "KAYBEDILDI"],
  GORUSME_YAPILDI: ["RANDEVU_VERILDI", "KAZANILDI", "KAYBEDILDI"],
  KAZANILDI: [],
  KAYBEDILDI: ["YENI"],
};

export const ADAY_KAYNAKLARI: Record<LeadSource, string> = {
  META: "Meta reklamı",
  WEB_SITESI: "Web sitesi",
  TELEFON: "Telefon",
  YOLDAN_GECEN: "Yoldan geçen",
  DIGER: "Diğer",
};

/**
 * Elle aday açarken seçilebilen kaynaklar. META ve WEB_SITESI makine
 * kaynaklarıdır: yalnız API girişi yazar, formda sunulmaz — sunulsaydı kaynak
 * raporundaki "reklam getirisi" sayısı elle şişirilebilirdi.
 */
export const ELLE_KAYNAKLAR: LeadSource[] = ["TELEFON", "YOLDAN_GECEN", "DIGER"];

export const ADAY_KAYIP_SEBEPLERI: Record<LeadLossReason, string> = {
  ULASILAMADI: "Ulaşılamadı",
  FIYAT: "Fiyat",
  UZAKLIK: "Uzaklık",
  PROGRAM_UYGUN_DEGIL: "Uygun program yok",
  VAZGECTI: "Vazgeçti",
  YANLIS_KAYIT: "Yanlış / mükerrer kayıt",
  DIGER: "Diğer",
};

export const ADAY_ETKINLIK_ETIKETLERI: Record<LeadActivityType, string> = {
  ARAMA: "Arandı",
  ULASILAMADI: "Arandı — ulaşılamadı",
  WHATSAPP: "WhatsApp yazışması",
  NOT: "Not",
  ASAMA_DEGISIMI: "Aşama değişti",
  SISTEM: "Sistem",
};

/** Şubenin açık (üzerinde çalışılan) adayları. */
export function acikAdayKosulu(subeId: string): Prisma.LeadWhereInput {
  return { branchId: subeId, stage: { in: ACIK_ASAMALAR } };
}

/**
 * §16.6 "Bugün aranacaklar" — takip tarihi bugüne veya öncesine ayarlı açık
 * adaylar. Gecikmişler DAHİL: kuyruk tek karttan okunur, geciken iş ayrı bir
 * kartta ikinci kez sayılmaz.
 */
export function bugunAranacakKosulu(
  subeId: string,
  gun: Date,
): Prisma.LeadWhereInput {
  return {
    branchId: subeId,
    stage: { in: ACIK_ASAMALAR },
    nextActionDate: { lte: gun },
  };
}

/** Takibi geçmiş (bugünden önceki güne ayarlı) açık adaylar. */
export function gecikmisAdayKosulu(
  subeId: string,
  gun: Date,
): Prisma.LeadWhereInput {
  return {
    branchId: subeId,
    stage: { in: ACIK_ASAMALAR },
    nextActionDate: { lt: gun },
  };
}

/**
 * Hiç dokunulmamış yeni aday: YENI aşamasında ve tek bir İNSAN etkinliği bile
 * yok. Reklamdan gelen aday ilk 24 saatte aranmalı — kartın varlık sebebi bu.
 * SISTEM satırları (createdByUserId null — API'nin mükerrer/eşleşme notları)
 * dokunulma sayılmaz: makinenin yazdığı not, adayın arandığını göstermez.
 */
export function dokunulmamisAdayKosulu(subeId: string): Prisma.LeadWhereInput {
  return {
    branchId: subeId,
    stage: "YENI",
    activities: { none: { createdByUserId: { not: null } } },
  };
}

/** Kaynak raporunun dönem süzgeci — createdAt kohortu (§16.7). */
export function adayAralikKosulu(
  subeId: string,
  baslangic?: Date,
  bitis?: Date,
): Prisma.LeadWhereInput {
  return {
    branchId: subeId,
    ...(baslangic || bitis
      ? {
          createdAt: {
            ...(baslangic ? { gte: baslangic } : {}),
            ...(bitis ? { lt: bitis } : {}),
          },
        }
      : {}),
  };
}
