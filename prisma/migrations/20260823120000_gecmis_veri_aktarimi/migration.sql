-- Geçmiş veri aktarımı — 2025-2026 öncesi dönemler ve arşiv raporları.
--
-- İki parça:
--   1) Term/Club."gecmisVerisi" — dışarıdan aktarılmış, puanlaması ve
--      müfredatı olmayan program. Rapor üretimine, müfredat ve puanlama
--      seçicilerine kapalıdır. `status = 'ARSIVLENDI'` bunu tek başına
--      yapamazdı: arşiv geri alınabilir bir görünürlük ayarı, oysa bu
--      dönemlerin puanı hiçbir zaman gelmeyecek.
--   2) "LegacyReport" — dışarıda (Excel'de) üretilmiş öğrenci değerlendirme
--      raporunun kendisi. `Report`/`ReportPdf` kullanılmadı; onların
--      bodyJson/snapshotJson alanları zorunlu ve bu belgelerin öyle bir
--      gövdesi yok.
--
-- İkili veri doğrudan tabloda tutuluyor ("IntelligenceTest" ile aynı gerekçe).

ALTER TABLE "Term" ADD COLUMN "gecmisVerisi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Club" ADD COLUMN "gecmisVerisi" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "LegacyReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "termLabel" TEXT NOT NULL,
    "groupLabel" TEXT,
    "reportDate" DATE NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyReport_pkey" PRIMARY KEY ("id")
);

-- Aynı kaynak dosya iki kez aktarılamaz; aktarım betiğinin idempotanlığı
-- bu kısıta dayanıyor.
CREATE UNIQUE INDEX "LegacyReport_sourcePath_key" ON "LegacyReport"("sourcePath");

CREATE INDEX "LegacyReport_studentId_reportDate_idx" ON "LegacyReport"("studentId", "reportDate");

ALTER TABLE "LegacyReport" ADD CONSTRAINT "LegacyReport_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegacyReport" ADD CONSTRAINT "LegacyReport_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
