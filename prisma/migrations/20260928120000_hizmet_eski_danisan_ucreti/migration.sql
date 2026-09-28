-- §17.9 — Eski danışanlara uygulanan ikinci ücret.
-- Boş bırakılabilir: ikinci fiyatı olmayan hizmette randevu formu tarife
-- seçimi göstermez. Mevcut katalog satırlarına dokunulmuyor.
ALTER TABLE "Hizmet" ADD COLUMN "eskiDanisanUcretKurus" INTEGER;
