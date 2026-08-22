"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alanHatalari, formDegerleri, type EylemDurumu } from "@/lib/formlar";
import { ESIK_SINIRLARI, raporAyariYaz } from "@/lib/rapor-ayarlari";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";

/**
 * §11.2 — Rapor eşiklerinin kaydedilmesi.
 *
 * YETKİ: raporlar modülünde TAM. Ayar bütün şubelerin raporunu etkiliyor ama
 * ayrı bir modül açılmadı: eşiği değiştirebilecek kişi zaten raporu üretip
 * düzenleyebilen kişidir.
 */

/** Formdaki alan adları — hata dönüşünde değerleri geri yazmak için. */
const AYAR_ALANLARI = [
  "atolyeYuksek",
  "atolyeDusuk",
  "gelisimFark",
  "asimetri",
  "kiyasAsgariOgrenci",
  "etiketYuksek",
  "etiketOrtalama",
  "etiketDusuk",
] as const;

/** "4,2" da "4.2" da kabul edilir — panelin geri kalanı virgüllü yazıyor. */
const ondalik = (sinir: { enAz: number; enFazla: number }, ad: string) =>
  z
    .string()
    .trim()
    .transform((deger) => Number(deger.replace(",", ".")))
    .refine(
      (deger) =>
        Number.isFinite(deger) && deger >= sinir.enAz && deger <= sinir.enFazla,
      {
        message: `${ad} ${sinir.enAz.toString().replace(".", ",")} ile ${sinir.enFazla.toString().replace(".", ",")} arasında olmalı.`,
      },
    );

const etiket = z
  .string()
  .trim()
  .min(2, "Kademe adı en az 2 karakter olmalı.")
  .max(24, "Kademe adı en fazla 24 karakter olabilir.");

const SEMA = z
  .object({
    atolyeYuksek: ondalik(ESIK_SINIRLARI.atolyeYuksek, "Yüksek eşiği"),
    atolyeDusuk: ondalik(ESIK_SINIRLARI.atolyeDusuk, "Düşük eşiği"),
    gelisimFark: ondalik(ESIK_SINIRLARI.gelisimFark, "Kıyas farkı"),
    asimetri: ondalik(ESIK_SINIRLARI.asimetri, "Asimetri eşiği"),
    kiyasAsgariOgrenci: z
      .string()
      .trim()
      .transform((deger) => Number(deger))
      .refine(
        (deger) =>
          Number.isInteger(deger) &&
          deger >= ESIK_SINIRLARI.kiyasAsgariOgrenci.enAz &&
          deger <= ESIK_SINIRLARI.kiyasAsgariOgrenci.enFazla,
        {
          message: `Asgari öğrenci sayısı ${ESIK_SINIRLARI.kiyasAsgariOgrenci.enAz} ile ${ESIK_SINIRLARI.kiyasAsgariOgrenci.enFazla} arasında tam sayı olmalı.`,
        },
      ),
    etiketYuksek: etiket,
    etiketOrtalama: etiket,
    etiketDusuk: etiket,
  })
  // Eşikler ters çevrilirse kademe hesabı sessizce anlamsızlaşır: her ortalama
  // aynı anda hem "yüksek" hem "düşük" dala düşebilir. Alan bazlı hata olarak
  // veriliyor ki kullanıcı hangi kutuyu düzelteceğini bilsin.
  .refine((veri) => veri.atolyeDusuk <= veri.atolyeYuksek, {
    path: ["atolyeDusuk"],
    message: "Düşük eşiği, yüksek eşiğinden büyük olamaz.",
  });

export async function raporAyariniKaydet(
  _onceki: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const degerler = formDegerleri(formVerisi, AYAR_ALANLARI);
  const cozum = SEMA.safeParse(degerler);

  if (!cozum.success) {
    return {
      hata: "Girilen değerlerde düzeltilecek yerler var.",
      alanHatalari: alanHatalari(cozum.error),
      degerler,
    };
  }

  const veri = cozum.data;
  await raporAyariYaz(
    {
      atolyeYuksek: veri.atolyeYuksek,
      atolyeDusuk: veri.atolyeDusuk,
      gelisimFark: veri.gelisimFark,
      asimetri: veri.asimetri,
      kiyasAsgariOgrenci: veri.kiyasAsgariOgrenci,
      etiketler: {
        YUKSEK: veri.etiketYuksek,
        ORTALAMA: veri.etiketOrtalama,
        DUSUK: veri.etiketDusuk,
      },
    },
    kullanici.id,
  );

  revalidatePath("/koordinator/raporlar/ayarlar");

  return {
    basari:
      "Rapor ayarları kaydedildi. Bundan sonra üretilecek raporlar bu ölçütleri kullanır; üretilmiş raporlar değişmez (yeniden üretmek gerekir).",
  };
}
