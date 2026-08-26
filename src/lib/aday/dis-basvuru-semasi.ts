import { z } from "zod";

/**
 * §16.5 — `POST /api/crm/aday` gövdesinin doğrulama şeması.
 *
 * İki tüketici var: entegratör (Pabbly/Make — Meta reklam formlarını buraya
 * aktarır) ve tuzder.org form işleyicisi (sunucudan sunucuya). Şema bilerek
 * BAĞIŞLAYICI: entegratör senaryosundaki bir eşleme hatası yüzünden gerçek
 * bir ailenin başvurusunu 422 ile düşürmek, eksik kayıttan daha kötü.
 * Zorunlu olan tek şey kaynak; kalan her eksik, kayda `EKSIK_VERI` /
 * `ESLEME_YOK` işaretiyle iner ve panelde yönetici uyarısı üretir.
 *
 * Tek istisna: web sitesi kaynağında KVKK onayı zorunlu — form bizim, onay
 * kutusuz gönderim bir yazılım hatasıdır ve veri hukuken alınamaz.
 */

const bosuAtla = (deger: unknown) =>
  typeof deger === "string" && deger.trim() === "" ? undefined : deger;

const kirpilmisMetin = (enFazla: number) =>
  z.preprocess(
    bosuAtla,
    z
      .string()
      .trim()
      // Entegratörden taşan alan başvuruyu düşürmesin: kırp, reddetme.
      .transform((deger) => deger.slice(0, enFazla))
      .optional(),
  );

export const DIS_BASVURU_SEMASI = z
  .object({
    kaynak: z.enum(["META", "WEB_SITESI"], {
      message: "kaynak META veya WEB_SITESI olmalı",
    }),
    /** Aktif `Branch.code` değerlerinden biri; çözülemezse varsayılan şube. */
    subeKodu: kirpilmisMetin(40),
    veliAdi: kirpilmisMetin(120),
    cocukAdi: kirpilmisMetin(120),
    yas: z.preprocess(
      bosuAtla,
      z.coerce
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        // Entegratör "7 yaşında" gibi bir metin geçirirse başvuru düşmesin;
        // yaş yalnızca kolaylık alanı, dönüşümde zaten yeniden sorulur.
        .catch(undefined),
    ),
    telefon: kirpilmisMetin(40),
    eposta: kirpilmisMetin(200),
    /** İlgilenilen program/atölye — serbest metin. */
    ilgi: kirpilmisMetin(200),
    mesaj: kirpilmisMetin(2000),
    /** Kampanya/form adı — anlık kopya olarak saklanır. */
    kaynakDetay: kirpilmisMetin(200),
    /** Meta leadgen kimliği — idempotency anahtarı. */
    disKimlik: kirpilmisMetin(100),
    kvkkOnay: z.preprocess(bosuAtla, z.coerce.boolean().optional()),
    /**
     * Bal küpü (honeypot): gerçek formda gizli ve boş durur; botlar doldurur.
     * Dolu gelirse rota sessizce 200 döner ve hiçbir şey yazmaz.
     */
    website: z.preprocess(bosuAtla, z.string().max(200).optional()),
  })
  .refine(
    (veri) => veri.kaynak !== "WEB_SITESI" || veri.kvkkOnay === true,
    {
      message: "Web sitesi başvurusunda KVKK onayı zorunludur",
      path: ["kvkkOnay"],
    },
  );

export type DisBasvuru = z.infer<typeof DIS_BASVURU_SEMASI>;
