-- Kayıt iptalinde sebep ve ayrılma anı tutulsun.
--
-- İptal tek tıkla oluyordu ve geriye hiçbir iz kalmıyordu: bir çocuğun 4.
-- haftada taşındığı için mi yoksa devamsızlıktan mı düştüğü, kaç atölyeyi
-- tamamlayabildiği sonradan okunamıyordu. Rapor ve dönem değerlendirmesi bu
-- ayrımı gerektiriyor.
CREATE TYPE "CancelReason" AS ENUM (
  'TASINMA',
  'SAGLIK',
  'AILEVI',
  'DEVAMSIZLIK',
  'DIGER'
);

ALTER TABLE "Enrollment"
  ADD COLUMN "cancelReason"     "CancelReason",
  ADD COLUMN "cancelNote"       TEXT,
  ADD COLUMN "cancelledAt"      TIMESTAMP(3),
  ADD COLUMN "lastAttendedWeek" INTEGER,
  ADD COLUMN "lastAttendedDate" DATE;

-- Alanlar yalnızca iptal edilmiş kayıtta anlamlı. Kısıt veritabanı
-- seviyesinde: kayıt yeniden etkinleştirildiğinde bu alanların temizlenmesi
-- uygulama katmanının hatırlamasına bırakılırsa, unutulduğu gün "aktif ama
-- 4. haftada ayrılmış" gibi kendi kendisiyle çelişen bir satır kalır.
ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_iptal_alanlari" CHECK (
    "status" = 'IPTAL'
    OR (
      "cancelReason"     IS NULL AND
      "cancelNote"       IS NULL AND
      "cancelledAt"      IS NULL AND
      "lastAttendedWeek" IS NULL AND
      "lastAttendedDate" IS NULL
    )
  );

-- Sebebe göre sayım ("bu dönem kaç çocuk taşındı") indeksten okunsun.
CREATE INDEX "Enrollment_cancelReason_idx" ON "Enrollment"("cancelReason");
