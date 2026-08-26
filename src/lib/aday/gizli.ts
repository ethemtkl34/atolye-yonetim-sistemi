import { timingSafeEqual } from "node:crypto";

/**
 * Aday API'sinin paylaşımlı sırrı.
 *
 * `env.ts`'e BİLEREK eklenmedi — OPENAI_API_KEY ile aynı gerekçe: Vercel'de
 * "Sensitive" işaretli değişkenler derleme anında gerçek değerleriyle
 * gelmiyor; modül yüklenirken zorunlu kılınsaydı derleme kırılır ya da boş
 * değer donardı. Çağrı anında okunur; yoksa uç 503 döner (yanlış
 * yapılandırma, yetkisiz istek gibi 401'le maskelenmez).
 */
export function adayApiJetonu(): string | null {
  return process.env.LEAD_API_TOKEN?.trim() || null;
}

/**
 * `Authorization: Bearer <jeton>` başlığını sabit zamanlı karşılaştırır.
 *
 * Düz `===` karşılaştırması, uyuşmazlığın yerine göre farklı sürede döner ve
 * jetonun karakter karakter sızdırılmasına (timing attack) kapı açar;
 * `timingSafeEqual` eşit uzunluktaki iki tamponu her zaman aynı sürede
 * karşılaştırır. Uzunluk kontrolü önce yapılır — fonksiyon eşit olmayan
 * uzunlukta zaten fırlatırdı.
 */
export function jetonGecerliMi(
  baslik: string | null,
  jeton: string,
): boolean {
  if (!baslik || !baslik.startsWith("Bearer ")) return false;
  const gelen = Buffer.from(baslik.slice("Bearer ".length).trim(), "utf8");
  const beklenen = Buffer.from(jeton, "utf8");
  if (gelen.length !== beklenen.length) return false;
  return timingSafeEqual(gelen, beklenen);
}
