-- §17.4 — Randevu tablosu.
--
-- Saat sözleşmesi: `baslangic`/`bitis` DUVAR SAATİ olarak, UTC sütununda
-- saklanır (14:00 randevusu 14:00 UTC yazılır ve 14:00 okunur). Panelin
-- `Lead.appointmentAt` ile kurduğu sözleşmenin aynısı; gerçek saat dilimi
-- dönüşümü yapılsaydı yaz saati değişiminde geçmiş randevular kayardı.
--
-- Uzman, hizmet, veli ve öğrenci bağları RESTRICT: randevusu olan bir kaydı
-- silmeyi veritabanı reddeder. Bu bilinçli — silme kontrolünü uygulama
-- katmanında elle saymak, bir gün güncellenmeyi unutulacak tek şeydi.

CREATE TYPE "RandevuDurumu" AS ENUM ('PLANLANDI', 'GERCEKLESTI', 'GELMEDI', 'IPTAL');

CREATE TABLE "Randevu" (
  "id"              TEXT NOT NULL,
  "branchId"        TEXT NOT NULL,
  "uzmanId"         TEXT NOT NULL,
  "hizmetId"        TEXT NOT NULL,
  "veliId"          TEXT NOT NULL,
  "ogrenciId"       TEXT,
  "baslangic"       TIMESTAMP(3) NOT NULL,
  "bitis"           TIMESTAMP(3) NOT NULL,
  "durum"           "RandevuDurumu" NOT NULL DEFAULT 'PLANLANDI',
  -- Katalog ücretinin açılış anındaki kopyası, kuruş cinsinden.
  "ucretKurus"      INTEGER NOT NULL,
  "indirimKurus"    INTEGER NOT NULL DEFAULT 0,
  "indirimNotu"     TEXT,
  -- Haftalık tekrar zinciri; "bundan sonrakiler" bu alandan çalışıyor.
  "seriId"          TEXT,
  "iptalNotu"       TEXT,
  "iptalEdenUserId" TEXT,
  "iptalAt"         TIMESTAMP(3),
  "not"             TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Randevu_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Randevu_aralik_sirali" CHECK ("baslangic" < "bitis"),
  -- Ücret sıfır olabilir (atölye görüşmesi ücretsiz), eksi olamaz.
  CONSTRAINT "Randevu_ucret_eksi_olamaz" CHECK ("ucretKurus" >= 0),
  -- İndirim ücreti aşarsa ciro eksiye düşerdi.
  CONSTRAINT "Randevu_indirim_araligi" CHECK (
    "indirimKurus" >= 0 AND "indirimKurus" <= "ucretKurus"
  ),
  -- İptal alanları birlikte dolar (Enrollment_iptal_alanlari deseni).
  CONSTRAINT "Randevu_iptal_alanlari" CHECK (
    ("durum" = 'IPTAL' AND "iptalAt" IS NOT NULL)
    OR ("durum" <> 'IPTAL' AND "iptalAt" IS NULL)
  )
);

-- Takvimin ana yolu: şube + gün aralığı.
CREATE INDEX "Randevu_branchId_baslangic_idx" ON "Randevu"("branchId", "baslangic");
-- Çakışma kontrolü ve uzmanın günü.
CREATE INDEX "Randevu_uzmanId_baslangic_idx" ON "Randevu"("uzmanId", "baslangic");
-- Velinin randevu geçmişi.
CREATE INDEX "Randevu_veliId_baslangic_idx" ON "Randevu"("veliId", "baslangic");
CREATE INDEX "Randevu_seriId_idx" ON "Randevu"("seriId");

ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_uzmanId_fkey"
  FOREIGN KEY ("uzmanId") REFERENCES "Uzman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_hizmetId_fkey"
  FOREIGN KEY ("hizmetId") REFERENCES "Hizmet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_veliId_fkey"
  FOREIGN KEY ("veliId") REFERENCES "Veli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_ogrenciId_fkey"
  FOREIGN KEY ("ogrenciId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_iptalEdenUserId_fkey"
  FOREIGN KEY ("iptalEdenUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Randevu"
  ADD CONSTRAINT "Randevu_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
