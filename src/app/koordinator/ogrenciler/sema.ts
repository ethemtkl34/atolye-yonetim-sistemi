import { z } from "zod";

/**
 * §6.1 — Öğrenci kayıt formunun doğrulama şeması.
 *
 * Ayrı bir dosyada duruyor çünkü hem `"use server"` işaretli işlemler hem de
 * istemci tarafındaki form bileşeni kullanıyor; `"use server"` dosyaları
 * fonksiyon dışında bir şey dışa aktaramıyor.
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

export const ogrenciSemasi = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Ad en az 2 karakter olmalı")
      .max(60, "Ad en fazla 60 karakter olabilir"),
    lastName: z
      .string()
      .trim()
      .min(2, "Soyad en az 2 karakter olmalı")
      .max(60, "Soyad en fazla 60 karakter olabilir"),
    birthDate: z.preprocess(
      bosuNullYap,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir doğum tarihi girin")
        .nullable(),
    ),
    school: isteğeBagliMetin(120, "Okul"),
    grade: isteğeBagliMetin(30, "Sınıf"),
    notes: isteğeBagliMetin(1000, "Notlar"),

    anneAdi: isteğeBagliMetin(120, "Anne adı"),
    anneTelefon: isteğeBagliMetin(30, "Anne telefonu"),
    babaAdi: isteğeBagliMetin(120, "Baba adı"),
    babaTelefon: isteğeBagliMetin(30, "Baba telefonu"),

    alerji: isteğeBagliMetin(500, "Alerji bilgisi"),
    ilac: isteğeBagliMetin(500, "İlaç bilgisi"),
    ozelEgitim: isteğeBagliMetin(500, "Özel eğitim bilgisi"),
    saglikNotu: isteğeBagliMetin(1000, "Sağlık durumu"),
    acilDurum: isteğeBagliMetin(1000, "Acil durum bilgisi"),
    stajyerUyarisi: isteğeBagliMetin(300, "Stajyer uyarısı"),
  })
  /**
   * §6.1 — "En az bir ebeveyne ait telefon numarası zorunlu olmalıdır."
   *
   * Tek bir alana bakarak doğrulanamadığı için form seviyesinde kontrol
   * ediliyor; veritabanı kısıtı da bunu ifade edemezdi.
   */
  .refine(
    (veri) => Boolean(veri.anneTelefon) || Boolean(veri.babaTelefon),
    {
      message:
        "Anne veya babadan en az birinin telefon numarası girilmelidir.",
      path: ["anneTelefon"],
    },
  )
  /** Telefonu girilen ebeveynin adı da bilinmelidir. */
  .refine((veri) => !veri.anneTelefon || Boolean(veri.anneAdi), {
    message: "Telefon girdiyseniz anne adını da yazın.",
    path: ["anneAdi"],
  })
  .refine((veri) => !veri.babaTelefon || Boolean(veri.babaAdi), {
    message: "Telefon girdiyseniz baba adını da yazın.",
    path: ["babaAdi"],
  });

export type OgrenciGirdisi = z.infer<typeof ogrenciSemasi>;

/** FormData'yı şemanın beklediği düz nesneye çevirir. */
export function formdanOku(formVerisi: FormData): Record<string, unknown> {
  const alanlar = [
    "firstName",
    "lastName",
    "birthDate",
    "school",
    "grade",
    "notes",
    "anneAdi",
    "anneTelefon",
    "babaAdi",
    "babaTelefon",
    "alerji",
    "ilac",
    "ozelEgitim",
    "saglikNotu",
    "acilDurum",
    "stajyerUyarisi",
  ] as const;

  return Object.fromEntries(
    alanlar.map((alan) => [alan, formVerisi.get(alan)]),
  );
}
