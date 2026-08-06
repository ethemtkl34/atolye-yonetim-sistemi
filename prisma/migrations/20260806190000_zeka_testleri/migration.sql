-- Zeka testleri.
--
-- Öğrencilere uygulanan zeka testlerinin (örn. WISC) sonuç belgeleri
-- saklanacak: yüklenen PDF/görsel dosya + test adı + uygulama tarihi +
-- isteğe bağlı not. Dosyanın ikili verisi veritabanında (BYTEA) — sistemde
-- ayrı nesne deposu yok; 4MB üst sınırı uygulama katmanı zorlar.
-- GİZLİLİK: test sonuçları stajyer sorgularına hiç girmez.
CREATE TABLE "IntelligenceTest" (
  "id"              TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "date"            DATE NOT NULL,
  "testName"        TEXT NOT NULL,
  "notes"           TEXT,
  "fileName"        TEXT NOT NULL,
  "mimeType"        TEXT NOT NULL,
  "fileSize"        INTEGER NOT NULL,
  "fileData"        BYTEA NOT NULL,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntelligenceTest_pkey" PRIMARY KEY ("id")
);

-- Cascade: öğrenci silinirse test belgeleri de gider (uygulama katmanı test
-- kaydı olan öğrencinin silinmesini zaten engelliyor — görüşme/puanlama
-- engeliyle aynı ilke). SetNull: kaydı yükleyen hesap silinse de belge kalır.
ALTER TABLE "IntelligenceTest"
  ADD CONSTRAINT "IntelligenceTest_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntelligenceTest"
  ADD CONSTRAINT "IntelligenceTest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "IntelligenceTest_studentId_date_idx"
  ON "IntelligenceTest"("studentId", "date");
