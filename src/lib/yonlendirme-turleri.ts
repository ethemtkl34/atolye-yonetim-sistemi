import { TERAPI_TURLERI } from "./terapi-turleri";

/**
 * Veli görüşmesinde kaydedilebilecek yönlendirme türleri — tek kaynak.
 *
 * Liste kurumun YÜRÜTTÜĞÜ hizmetlerden türer: terapi türleri
 * (`terapi-turleri.ts`) olduğu gibi alınır, üzerine terapi olmayan üç
 * yönlendirme eklenir (zeka testi, atölye, kulüp). Kurumun sunmadığı bir
 * hizmete yönlendirme yapılamaz — kâğıt formdaki "Filial Terapi" kartı bu
 * yüzden buraya girmedi; "Psiko Rol Drama" ve "Robotik Kodlama" ise tek bir
 * `KULUP` yönlendirmesinde toplandı, hangi kulüp olduğu nota yazılır.
 *
 * NEDEN AYRI KAYIT: yönlendirmenin ömrü görüşmeden uzun. Form bunları
 * "öğrenci sonraki döneme geldiğinde ekip ne önerilmiş görsün" diye tutuyor;
 * bu soru ancak satırdan sorgulanabilir, brief JSON'unun içinden değil.
 *
 * `deger` alanı veritabanındaki `ReferralKind` enum'ıyla birebir aynı olmak
 * zorunda — buraya bir tür eklemek migration ister (`terapi-turleri.ts`teki
 * kuralın aynısı). Terapi türü eklenirse İKİ enum birden büyür.
 *
 * SIRA ÖNEMLİ: kartlar bu diziyi olduğu gibi çizer.
 */

/** Terapi olmayan yönlendirmeler; terapi türlerinden SONRA gelir. */
const TERAPI_DISI = [
  {
    deger: "ZEKA_TESTI",
    etiket: "Zeka testi",
    simge: "🧩",
    ipucu: "Hangi test / gerekçe…",
  },
  {
    deger: "ATOLYE",
    etiket: "TÜZDER atölyesi",
    simge: "🏫",
    ipucu: "Hangi atölye / not…",
  },
  {
    deger: "KULUP",
    etiket: "Kulüp",
    simge: "🎬",
    ipucu: "Hangi kulüp (drama, robotik…) / not…",
  },
] as const;

export const YONLENDIRME_TURLERI = [
  ...TERAPI_TURLERI.map((tur) => ({
    deger: tur.deger,
    etiket: tur.etiket,
    simge: "🧠",
    ipucu: "Not / gerekçe…",
  })),
  ...TERAPI_DISI,
] as const;

export type YonlendirmeTuru =
  | (typeof TERAPI_TURLERI)[number]["deger"]
  | (typeof TERAPI_DISI)[number]["deger"];

export const YONLENDIRME_ETIKETLERI = Object.fromEntries(
  YONLENDIRME_TURLERI.map((tur) => [tur.deger, tur.etiket]),
) as Record<YonlendirmeTuru, string>;

/** Form alanından gelen değer geçerli bir tür mü. */
export function yonlendirmeTuruMu(deger: unknown): deger is YonlendirmeTuru {
  return (
    typeof deger === "string" &&
    Object.prototype.hasOwnProperty.call(YONLENDIRME_ETIKETLERI, deger)
  );
}

/**
 * Yönlendirme işaretlendiğinde uzmanın kaydı hangi ekranda açacağı.
 *
 * Kaydı sistem AÇMAZ, yalnızca yolu gösterir: yanlış işaretlenmiş bir kutu
 * sessizce terapi dosyası oluşturmamalı. Karşılığı olmayan türler (atölye,
 * kulüp) null döner — onların kaydı kayıt/kulüp ekranlarından yürüyor.
 */
export function yonlendirmeKayitYolu(tur: YonlendirmeTuru): string | null {
  if (tur === "ZEKA_TESTI") return "/koordinator/zeka-testleri";
  if (tur === "ATOLYE" || tur === "KULUP") return null;
  return "/koordinator/danismanlik";
}
