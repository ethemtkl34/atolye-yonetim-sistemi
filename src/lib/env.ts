import { z } from "zod";

/**
 * Ortam değişkenleri uygulama açılırken doğrulanır. Eksik veya hatalı bir
 * değişken varsa uygulama sessizce yanlış çalışmak yerine hemen ve anlaşılır
 * bir hata ile durur.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL tanımlı değil"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET en az 16 karakter olmalı"),
  AUTH_URL: z.string().url().optional(),
  /**
   * Rapor metinlerini üreten OpenAI anahtarı. İSTEĞE BAĞLI: anahtar yokken
   * uygulama çalışmaya devam eder ve rapor metni şablonla üretilir (§11.2).
   * Zorunlu yapmak, yapay zekâ tarafı henüz kurulmamış bir ortamda bütün
   * paneli düşürürdü.
   */
  OPENAI_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detay = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Ortam değişkenleri hatalı. .env dosyanızı .env.example ile karşılaştırın:\n${detay}`,
  );
}

export const env = parsed.data;
