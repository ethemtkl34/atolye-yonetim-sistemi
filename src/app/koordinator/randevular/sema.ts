import { z } from "zod";
import { tarihCozumle } from "@/lib/tarih";
import {
  EN_AZ_TEKRAR_HAFTASI,
  EN_FAZLA_TEKRAR_HAFTASI,
  VARSAYILAN_TEKRAR_HAFTASI,
} from "@/lib/randevu/tekrar";
import { saatiDakikayaCevir } from "../uzmanlar/sema";

/**
 * §17.4 — Randevu formunun doğrulama şeması.
 *
 * Ayrı dosyada: hem `"use server"` eylemleri hem istemci form bileşeni
 * kullanıyor (bkz. ogrenciler/sema.ts şerhi).
 */

// "hafta" ilk sırada: varsayılan görünüm budur (bkz. page.tsx) — koordinatör
// panele girince önce haftanın doluluğunu görsün. "izgara" tarih aralığı
// bakımından "gun" ile birebir aynı davranır (takvim-verisi.ts).
export const GORUNUMLER = ["hafta", "izgara", "gun", "ay"] as const;
export type Gorunum = (typeof GORUNUMLER)[number];

export function gorunumMu(deger: unknown): deger is Gorunum {
  return (
    typeof deger === "string" &&
    (GORUNUMLER as readonly string[]).includes(deger)
  );
}

export const GORUNUM_ADLARI: Record<Gorunum, string> = {
  // Kullanıcının kendi sözcüğü ("haftalık programı da görebilsin").
  izgara: "Program",
  // Eski "Gün" etiketi: liste görünümü ikinci sıraya düştü.
  gun: "Liste",
  hafta: "Hafta",
  ay: "Ay",
};

const bosuNullYap = (deger: unknown) =>
  typeof deger === "string" && deger.trim() === "" ? null : deger;

export const randevuSemasi = z
  .object({
    uzmanId: z.string().min(1, "Uzman seçin"),
    hizmetId: z.string().min(1, "Hizmet seçin"),

    /**
     * Danışan VELİ (§17.1). İki yol var: kayıtlı veliyi seçmek ya da adı ve
     * telefonuyla yenisini açmak — telefonla arayan bir veli için önce
     * öğrenci kaydı açtırmak kabul edilemez bir sürtünme olurdu.
     */
    veliId: z.preprocess(bosuNullYap, z.string().nullable()),
    yeniVeliAdi: z.preprocess(
      bosuNullYap,
      z
        .string()
        .trim()
        .min(2, "Veli adı en az 2 karakter olmalı")
        .max(120, "Ad en fazla 120 karakter olabilir")
        .nullable(),
    ),
    yeniVeliTelefon: z.preprocess(
      bosuNullYap,
      z.string().trim().max(30, "Telefon en fazla 30 karakter").nullable(),
    ),

    /** Seansa giren çocuk; aile danışmanlığında boş kalır. */
    ogrenciId: z.preprocess(bosuNullYap, z.string().nullable()),

    /**
     * "Yeni öğrenci ekle" — veli aranan çocuk henüz kayıtlı değilse (bkz.
     * `veli-secici.tsx`). Bilinçli olarak dar: yalnız ad/soyad/doğum tarihi;
     * okul, sağlık, veli bağı (Guardian) gibi alanlar burada YOK — telefonda
     * randevu veren biri için tam öğrenci formunu doldurtmak (§6.1'deki gibi)
     * kabul edilemez bir sürtünme olurdu. Eksik kalan bilgi gerekirse
     * Öğrenciler ekranından tamamlanır.
     */
    yeniOgrenciAdi: z.preprocess(
      bosuNullYap,
      z
        .string()
        .trim()
        .min(2, "Öğrenci adı en az 2 karakter olmalı")
        .max(60, "Ad en fazla 60 karakter olabilir")
        .nullable(),
    ),
    yeniOgrenciSoyadi: z.preprocess(
      bosuNullYap,
      z
        .string()
        .trim()
        .min(2, "Öğrenci soyadı en az 2 karakter olmalı")
        .max(60, "Soyad en fazla 60 karakter olabilir")
        .nullable(),
    ),
    yeniOgrenciDogumTarihi: z.preprocess(
      bosuNullYap,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir doğum tarihi girin")
        .refine((deger) => tarihCozumle(deger) !== null, {
          message: "Geçerli bir doğum tarihi girin",
        })
        .nullable(),
    ),

    tarih: z.string().trim().min(1, "Tarih seçin"),
    saat: z
      .string()
      .trim()
      .refine((deger) => saatiDakikayaCevir(deger) !== null, {
        message: "Saat SS:DD biçiminde olmalı",
      }),

    /** Lira olarak girilen indirim; kuruşa eylemde çevriliyor. */
    indirimLira: z.coerce
      .number()
      .min(0, "İndirim eksi olamaz")
      .max(1_000_000, "İndirim çok yüksek görünüyor")
      .default(0),
    indirimNotu: z.preprocess(
      bosuNullYap,
      z.string().trim().max(200, "Not en fazla 200 karakter").nullable(),
    ),

    haftaSayisi: z.coerce
      .number()
      .int()
      .min(EN_AZ_TEKRAR_HAFTASI)
      .max(EN_FAZLA_TEKRAR_HAFTASI)
      .default(VARSAYILAN_TEKRAR_HAFTASI),

    not: z.preprocess(
      bosuNullYap,
      z.string().trim().max(2000, "Not en fazla 2000 karakter").nullable(),
    ),
  })
  .superRefine((veri, ctx) => {
    // Ya kayıtlı veli seçilmiş olmalı ya da yeni velinin adı girilmiş.
    if (!veri.veliId && !veri.yeniVeliAdi) {
      ctx.addIssue({
        code: "custom",
        path: ["veliId"],
        message: "Kayıtlı bir veli seçin ya da yeni velinin adını yazın.",
      });
    }
    // Yeni öğrenci açılıyorsa ad VE soyad birlikte gelmeli — biri diğerini
    // sessizce boş bırakırsa öğrenci yarım bir adla kaydolurdu.
    if (Boolean(veri.yeniOgrenciAdi) !== Boolean(veri.yeniOgrenciSoyadi)) {
      ctx.addIssue({
        code: "custom",
        path: ["yeniOgrenciSoyadi"],
        message: "Yeni öğrencinin adını ve soyadını birlikte yazın.",
      });
    }
  });

export type RandevuGirdisi = z.infer<typeof randevuSemasi>;

export const RANDEVU_FORM_ALANLARI = [
  "uzmanId",
  "hizmetId",
  "veliId",
  "yeniVeliAdi",
  "yeniVeliTelefon",
  "ogrenciId",
  "yeniOgrenciAdi",
  "yeniOgrenciSoyadi",
  "yeniOgrenciDogumTarihi",
  "tarih",
  "saat",
  "indirimLira",
  "indirimNotu",
  "haftaSayisi",
  "not",
] as const;

/**
 * §17.4 — Var olan bir randevuyu düzenleme şeması.
 *
 * `randevuSemasi`'nin daraltılmış hâli: danışan (veli/çocuk) burada YOK —
 * randevuyu kimin aldığını değiştirmek ayrı ve daha riskli bir işlem, bu
 * ekranın kapsamı değil. `haftaSayisi` de yok: düzenleme her zaman TEK
 * randevuyu hedefler, seriye yeni hafta eklemez.
 */
export const randevuDuzenleSemasi = z.object({
  uzmanId: z.string().min(1, "Uzman seçin"),
  hizmetId: z.string().min(1, "Hizmet seçin"),
  tarih: z.string().trim().min(1, "Tarih seçin"),
  saat: z
    .string()
    .trim()
    .refine((deger) => saatiDakikayaCevir(deger) !== null, {
      message: "Saat SS:DD biçiminde olmalı",
    }),
  indirimLira: z.coerce
    .number()
    .min(0, "İndirim eksi olamaz")
    .max(1_000_000, "İndirim çok yüksek görünüyor")
    .default(0),
  indirimNotu: z.preprocess(
    bosuNullYap,
    z.string().trim().max(200, "Not en fazla 200 karakter").nullable(),
  ),
  not: z.preprocess(
    bosuNullYap,
    z.string().trim().max(2000, "Not en fazla 2000 karakter").nullable(),
  ),
});

export type RandevuDuzenleGirdisi = z.infer<typeof randevuDuzenleSemasi>;

export const RANDEVU_DUZENLE_FORM_ALANLARI = [
  "uzmanId",
  "hizmetId",
  "tarih",
  "saat",
  "indirimLira",
  "indirimNotu",
  "not",
] as const;

export const DURUM_ADLARI = {
  PLANLANDI: "Planlandı",
  GERCEKLESTI: "Gerçekleşti",
  GELMEDI: "Gelmedi",
  IPTAL: "İptal",
} as const;

/**
 * Durum rozetinin tonu. `GERCEKLESTI` ciroya giren tek durum, olumlu;
 * `GELMEDI` boşa giden yer, uyarı; `IPTAL` sönük.
 */
export const DURUM_ROZETLERI = {
  PLANLANDI: "notr",
  GERCEKLESTI: "olumlu",
  GELMEDI: "uyari",
  IPTAL: "pasif",
} as const;
