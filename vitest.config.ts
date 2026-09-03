import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    /**
     * Sahte ortam değişkenleri.
     *
     * `lib/env.ts` modül yüklenirken doğrulama yapıyor ve `lib/db.ts`i içeren
     * her dosya onu zincirleme çekiyor. Testler veritabanına HİÇ gitmiyor —
     * yalnızca o dosyalardaki saf fonksiyonlar sınanıyor — ama import
     * aşamasında doğrulama patladığı için dosya hiç yüklenemiyordu.
     *
     * Değerler bilerek bağlanamaz: bir test yanlışlıkla sorgu çalıştırırsa
     * sessizce bir veritabanına yazmak yerine bağlantı hatası versin.
     */
    env: {
      DATABASE_URL: "postgresql://test:test@127.0.0.1:1/testte-veritabani-yok",
      AUTH_SECRET: "testte-kullanilan-sahte-anahtar-en-az-16-karakter",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
