import { z } from "zod";
import { tarihCozumle } from "@/lib/tarih";
import { TERAPI_TURLERI } from "@/lib/terapi-turleri";

/**
 * Danışan başvurusu formunun doğrulama şeması.
 *
 * Ayrı dosyada, öğrenci formundaki gerekçenin aynısıyla: hem `"use server"`
 * eylemi hem istemci bileşeni okuyor.
 *
 * FORMUN İKİ MODU var ve şema ikisini de tek şemayla karşılıyor:
 *   - "yeni":   çocuk sistemde yok — ad, soyad ve veli bilgileri zorunlu.
 *   - "mevcut": çocuk zaten kayıtlı (çoğunlukla atölyeden geliyor) — yalnızca
 *               öğrenci seçilir, kimlik alanları hiç sorulmaz.
 * Ayrımı `mod` alanı taşıyor; hangi alanların zorunlu olduğu ona bağlı
 * (aşağıdaki `superRefine`). İki ayrı şema yazmak, ortak olan başvuru
 * alanlarını (asıl gövde) ikiye kopyalamak demekti.
 */

const bosuNullYap = (deger: unknown) =>
  typeof deger === "string" && deger.trim() === "" ? null : deger;

const isteğeBagliMetin = (enFazla: number, alanAdi: string) =>
  z.preprocess(
    bosuNullYap,
    z
      .string()
      .trim()
      .max(enFazla, `${alanAdi} en fazla ${enFazla} karakter olabilir`)
      .nullable(),
  );

export const EBEVEYN_DURUMU_ETIKETLERI = {
  BIRLIKTE: "Birlikte yaşıyor",
  AYRI: "Ayrı yaşıyor",
  BOSANMIS: "Boşanmış",
  VEFAT: "Ebeveyn vefatı",
  DIGER: "Diğer",
} as const;

export const danisanSemasi = z
  .object({
    mod: z.enum(["yeni", "mevcut"]),

    /** "mevcut" modunda dolu, "yeni" modunda boş. */
    ogrenciId: isteğeBagliMetin(50, "Öğrenci"),

    // --- Kimlik (yalnızca "yeni" modunda sorulur) ---
    firstName: isteğeBagliMetin(60, "Ad"),
    lastName: isteğeBagliMetin(60, "Soyad"),
    birthDate: z.preprocess(
      bosuNullYap,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir doğum tarihi girin")
        .refine((deger) => tarihCozumle(deger) !== null, {
          message: "Geçerli bir doğum tarihi girin",
        })
        .nullable(),
    ),
    school: isteğeBagliMetin(120, "Okul"),
    grade: isteğeBagliMetin(30, "Sınıf"),
    anneAdi: isteğeBagliMetin(120, "Anne adı"),
    anneTelefon: isteğeBagliMetin(30, "Anne telefonu"),
    babaAdi: isteğeBagliMetin(120, "Baba adı"),
    babaTelefon: isteğeBagliMetin(30, "Baba telefonu"),

    // --- Başvuru bilgileri ---
    terapiTuru: z.enum(
      TERAPI_TURLERI.map((tur) => tur.deger),
      { message: "Terapi türünü seçin" },
    ),
    basvuruNedeni: z
      .string()
      .trim()
      .min(1, "Başvuru nedenini yazın")
      .max(2000, "Başvuru nedeni en fazla 2000 karakter olabilir"),
    yonlendiren: isteğeBagliMetin(200, "Yönlendiren"),

    // --- Önceki destek ve tanı ---
    oncekiDestek: isteğeBagliMetin(1000, "Önceki destek bilgisi"),
    tani: isteğeBagliMetin(500, "Tanı"),
    ilac: isteğeBagliMetin(500, "İlaç bilgisi"),

    // --- Aile yapısı ---
    kardesler: isteğeBagliMetin(500, "Kardeş bilgisi"),
    birlikteYasadiklari: isteğeBagliMetin(300, "Birlikte yaşadığı kişiler"),
    ebeveynDurumu: z.preprocess(
      bosuNullYap,
      z
        .enum(
          Object.keys(EBEVEYN_DURUMU_ETIKETLERI) as [
            keyof typeof EBEVEYN_DURUMU_ETIKETLERI,
          ],
        )
        .nullable(),
    ),
    anneEgitim: isteğeBagliMetin(120, "Anne öğrenim durumu"),
    anneMeslek: isteğeBagliMetin(120, "Anne mesleği"),
    babaEgitim: isteğeBagliMetin(120, "Baba öğrenim durumu"),
    babaMeslek: isteğeBagliMetin(120, "Baba mesleği"),
    ailedeRuhsalOyku: isteğeBagliMetin(1000, "Ailede ruhsal hastalık öyküsü"),
  })
  .superRefine((veri, kontrol) => {
    if (veri.mod === "mevcut") {
      if (!veri.ogrenciId) {
        kontrol.addIssue({
          code: "custom",
          path: ["ogrenciId"],
          message: "Öğrenci seçin",
        });
      }
      return;
    }

    // "yeni" modunun kimlik kuralları — öğrenci formundakilerle aynı sözleşme:
    // ad/soyad zorunlu, en az bir ebeveyn telefonu zorunlu, telefonu girilen
    // ebeveynin adı da bilinmeli.
    if (!veri.firstName || veri.firstName.length < 2) {
      kontrol.addIssue({
        code: "custom",
        path: ["firstName"],
        message: "Ad en az 2 karakter olmalı",
      });
    }
    if (!veri.lastName || veri.lastName.length < 2) {
      kontrol.addIssue({
        code: "custom",
        path: ["lastName"],
        message: "Soyad en az 2 karakter olmalı",
      });
    }
    if (!veri.anneTelefon && !veri.babaTelefon) {
      kontrol.addIssue({
        code: "custom",
        path: ["anneTelefon"],
        message: "Anne veya babadan en az birinin telefonu girilmelidir.",
      });
    }
    if (veri.anneTelefon && !veri.anneAdi) {
      kontrol.addIssue({
        code: "custom",
        path: ["anneAdi"],
        message: "Telefon girdiyseniz anne adını da yazın.",
      });
    }
    if (veri.babaTelefon && !veri.babaAdi) {
      kontrol.addIssue({
        code: "custom",
        path: ["babaAdi"],
        message: "Telefon girdiyseniz baba adını da yazın.",
      });
    }
  });

export type DanisanGirdisi = z.infer<typeof danisanSemasi>;

/** Formun bütün alan adları — okuma ve hata durumunda geri döndürme için. */
export const DANISAN_FORM_ALANLARI = [
  "mod",
  "ogrenciId",
  "firstName",
  "lastName",
  "birthDate",
  "school",
  "grade",
  "anneAdi",
  "anneTelefon",
  "babaAdi",
  "babaTelefon",
  "terapiTuru",
  "basvuruNedeni",
  "yonlendiren",
  "oncekiDestek",
  "tani",
  "ilac",
  "kardesler",
  "birlikteYasadiklari",
  "ebeveynDurumu",
  "anneEgitim",
  "anneMeslek",
  "babaEgitim",
  "babaMeslek",
  "ailedeRuhsalOyku",
] as const;

/** FormData'yı şemanın beklediği düz nesneye çevirir. */
export function danisanFormdanOku(
  formVerisi: FormData,
): Record<string, unknown> {
  return Object.fromEntries(
    DANISAN_FORM_ALANLARI.map((alan) => [alan, formVerisi.get(alan)]),
  );
}
