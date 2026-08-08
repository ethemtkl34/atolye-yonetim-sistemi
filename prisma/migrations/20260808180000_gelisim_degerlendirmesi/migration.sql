-- Sosyal Duygusal Bilişsel Beceriler testi.
--
-- Stajyerin her öğrencisi için dönem ortasında ve dönem sonunda bir kez
-- doldurduğu, atölye oturumlarından bağımsız değerlendirme. Sorular kodda
-- sabit (lib/gelisim-degerlendirmesi.ts); cevaplar soru metnini kendi içinde
-- taşır (questionTextSnapshot ilkesi, ParentMeeting.answersJson deseni).

CREATE TYPE "AssessmentPeriod" AS ENUM ('DONEM_ORTASI', 'DONEM_SONU');

CREATE TABLE "DevelopmentAssessment" (
  "id"             TEXT NOT NULL,
  "enrollmentId"   TEXT NOT NULL,
  "period"         "AssessmentPeriod" NOT NULL,
  -- [{anahtar, kategori, baslik, soruMetni, deger}] — deger 1-5 ya da null.
  "answersJson"    JSONB NOT NULL,
  "filledByUserId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DevelopmentAssessment_pkey" PRIMARY KEY ("id"),

  -- Son savunma hattı: gövde her zaman bir dizi olmalı; uygulama katmanı
  -- aşılsa bile tek bir nesne veya metin yazılamaz.
  CONSTRAINT "DevelopmentAssessment_cevap_dizisi"
    CHECK (jsonb_typeof("answersJson") = 'array')
);

-- Kayıt başına her dönem noktası bir kez.
CREATE UNIQUE INDEX "DevelopmentAssessment_enrollmentId_period_key"
  ON "DevelopmentAssessment"("enrollmentId", "period");

ALTER TABLE "DevelopmentAssessment"
  ADD CONSTRAINT "DevelopmentAssessment_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull: stajyer hesabı silinse de değerlendirme geçmişi korunur
-- (Enrollment.internId ile aynı gerekçe).
ALTER TABLE "DevelopmentAssessment"
  ADD CONSTRAINT "DevelopmentAssessment_filledByUserId_fkey"
  FOREIGN KEY ("filledByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
