import { z } from "zod";
import { UZMAN_RENKLERI } from "@/lib/uzman-renkleri";

/**
 * §17.3 — Uzman, mesai, izin ve hizmet formlarının doğrulama şemaları.
 *
 * Ayrı dosyada çünkü hem `"use server"` eylemleri hem istemci form bileşeni
 * kullanıyor; `"use server"` dosyaları fonksiyon dışında bir şey dışa
 * aktaramıyor (üretimde 500'e düşüren tuzak — bkz. ogrenciler/sema.ts).
 */

/** "09:00" → 540. Geçersiz metinde null. */
export function saatiDakikayaCevir(metin: string): number | null {
  const eslesme = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(metin.trim());
  if (!eslesme) return null;
  return Number(eslesme[1]) * 60 + Number(eslesme[2]);
}

/** 540 → "09:00". Takvim ve mesai tablosu bunu okuyor. */
export function dakikayiSaateCevir(dakika: number): string {
  const saat = Math.floor(dakika / 60);
  const kalan = dakika % 60;
  return `${String(saat).padStart(2, "0")}:${String(kalan).padStart(2, "0")}`;
}

const saatAlani = (mesaj: string) =>
  z
    .string()
    .trim()
    .refine((deger) => saatiDakikayaCevir(deger) !== null, { message: mesaj });

export const GUNLER = [
  "PAZARTESI",
  "SALI",
  "CARSAMBA",
  "PERSEMBE",
  "CUMA",
  "CUMARTESI",
  "PAZAR",
] as const;

export const uzmanSemasi = z.object({
  ad: z
    .string()
    .trim()
    .min(2, "Uzmanın adı en az 2 karakter olmalı")
    .max(120, "Ad en fazla 120 karakter olabilir"),
  renk: z.enum(
    UZMAN_RENKLERI.map((renk) => renk.anahtar),
    { message: "Palet dışında bir renk seçilemez" },
  ),
  calismaTipi: z.enum(["TAM_ZAMANLI", "YARI_ZAMANLI"], {
    message: "Çalışma tipini seçin",
  }),
  /**
   * En az bir şube ZORUNLU: şubesiz uzman hiçbir takvimde görünmez ve
   * randevu formunda seçilemez — kaydedilmesinin bir anlamı olmaz.
   */
  subeIdleri: z
    .array(z.string().min(1))
    .min(1, "Uzman en az bir şubede çalışmalı"),
  /** Yetkinlik boş bırakılabilir; sonradan atanır. */
  hizmetIdleri: z.array(z.string().min(1)).default([]),
  /** Panel hesabı isteğe bağlı — uzmanların çoğu panele girmiyor. */
  userId: z
    .string()
    .trim()
    .transform((deger) => (deger === "" ? null : deger))
    .nullable(),
});

export type UzmanGirdisi = z.infer<typeof uzmanSemasi>;

export const mesaiSemasi = z
  .object({
    gun: z.enum(GUNLER, { message: "Gün seçin" }),
    subeId: z.string().min(1, "Şube seçin"),
    baslangic: saatAlani("Başlangıç saati SS:DD biçiminde olmalı"),
    bitis: saatAlani("Bitiş saati SS:DD biçiminde olmalı"),
  })
  .refine(
    (veri) =>
      (saatiDakikayaCevir(veri.baslangic) ?? 0) <
      (saatiDakikayaCevir(veri.bitis) ?? 0),
    { message: "Bitiş saati başlangıçtan sonra olmalı", path: ["bitis"] },
  );

export const izinSemasi = z
  .object({
    /**
     * Tarih + saat birlikte: yarım günlük izinler var (öğleden sonra
     * doktor randevusu). Tam gün izin 00:00–00:00 olarak yazılır ve
     * eylem bitişi ertesi güne taşır.
     */
    baslangicTarih: z.string().trim().min(1, "Başlangıç tarihi girin"),
    bitisTarih: z.string().trim().min(1, "Bitiş tarihi girin"),
    tamGun: z.boolean().default(true),
    baslangicSaat: z.string().trim(),
    bitisSaat: z.string().trim(),
    sebep: z
      .string()
      .trim()
      .max(200, "Sebep en fazla 200 karakter olabilir")
      .nullable(),
  })
  .superRefine((veri, ctx) => {
    if (veri.tamGun) return;
    if (saatiDakikayaCevir(veri.baslangicSaat) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["baslangicSaat"],
        message: "Başlangıç saati SS:DD biçiminde olmalı",
      });
    }
    if (saatiDakikayaCevir(veri.bitisSaat) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["bitisSaat"],
        message: "Bitiş saati SS:DD biçiminde olmalı",
      });
    }
  });

/**
 * Hizmet formu. Ücret arayüzde LİRA olarak giriliyor, veritabanında kuruş
 * tutuluyor — kullanıcıya "320000" yazdırmak kabul edilemez, kayan noktayla
 * saklamak da (bkz. şema şerhi).
 */
export const hizmetSemasi = z.object({
  ad: z
    .string()
    .trim()
    .min(2, "Hizmet adı en az 2 karakter olmalı")
    .max(120, "Ad en fazla 120 karakter olabilir"),
  grup: z.enum(["TEST", "DANISMANLIK", "ATOLYE"], {
    message: "Hizmet grubunu seçin",
  }),
  sureDk: z.coerce
    .number()
    .int("Süre tam dakika olmalı")
    .min(1, "Süre en az 1 dakika olmalı")
    .max(480, "Süre en fazla 8 saat olabilir"),
  ucretLira: z.coerce
    .number()
    .min(0, "Ücret eksi olamaz")
    .max(1_000_000, "Ücret çok yüksek görünüyor"),
  yasAlt: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(120)])
    .transform((deger) => (deger === "" ? null : deger)),
  yasUst: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(120)])
    .transform((deger) => (deger === "" ? null : deger)),
  danisanTuru: z.enum(["COCUK", "VELI"], { message: "Danışan türünü seçin" }),
  tekrarli: z.boolean().default(false),
});

/** Lira girdisini kuruşa çevirir — kayan nokta artığı yuvarlanır. */
export function liradanKurusa(lira: number): number {
  return Math.round(lira * 100);
}

/** Kuruşu ekranda gösterilecek liraya çevirir. */
export function kurustanLiraya(kurus: number): number {
  return kurus / 100;
}

/** ₺1.234,50 biçiminde para metni. */
export function paraMetni(kurus: number): string {
  return kurustanLiraya(kurus).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  });
}

/** "1 sa 30 dk" biçiminde süre metni. */
export function sureMetni(dakika: number): string {
  const saat = Math.floor(dakika / 60);
  const kalan = dakika % 60;
  if (saat === 0) return `${kalan} dk`;
  if (kalan === 0) return `${saat} sa`;
  return `${saat} sa ${kalan} dk`;
}
