-- Danışan başvurusu.
--
-- Psikologlar atölyeye bağlı olmayan çocuk da alıyor; terapi danışanlığı
-- öğrencilikten bağımsız bir durum. Başvuru bilgileri `Student` üzerine
-- yayılmak yerine kendi satırında duruyor: atölye öğrencilerinde boş alanlar
-- oluşmuyor ve "bu çocuğun başvurusu var mı" sorusu satırın varlığıyla
-- cevaplanıyor. Atölyeden gelen çocuk için de sonradan açılabilir.
CREATE TYPE "ParentStatus" AS ENUM (
  'BIRLIKTE',
  'AYRI',
  'BOSANMIS',
  'VEFAT',
  'DIGER'
);

CREATE TABLE "TherapyIntake" (
  "id"              TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "therapyType"     "TherapyType" NOT NULL,
  "reason"          TEXT NOT NULL,
  "referredBy"      TEXT,
  "previousSupport" TEXT,
  "diagnosis"       TEXT,
  "siblings"        TEXT,
  "livesWith"       TEXT,
  "parentStatus"    "ParentStatus",
  "familyHistory"   TEXT,
  -- Ebeveyn öğrenim/meslek bilgisi Guardian'a değil buraya: başvuru bağlamında
  -- alınıyor ve atölyeden gelen çocuğun başvurusunda da aynı formdan geçiyor.
  "motherEducation"  TEXT,
  "motherOccupation" TEXT,
  "fatherEducation"  TEXT,
  "fatherOccupation" TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TherapyIntake_pkey" PRIMARY KEY ("id")
);

-- Öğrenci başına en fazla bir başvuru: bu bir seans kaydı değil, terapi
-- dosyasının kapağı. Güncelleme üzerine yazar.
CREATE UNIQUE INDEX "TherapyIntake_studentId_key" ON "TherapyIntake"("studentId");

ALTER TABLE "TherapyIntake"
  ADD CONSTRAINT "TherapyIntake_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Kaydı giren hesap silinse de başvuru kalır (görüşme kayıtlarındaki desen).
ALTER TABLE "TherapyIntake"
  ADD CONSTRAINT "TherapyIntake_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
