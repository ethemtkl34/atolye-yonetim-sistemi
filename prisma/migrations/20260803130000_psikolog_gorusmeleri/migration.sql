-- Psikolog görüşmeleri.
--
-- Öğrenciler süreç boyunca kurumun psikologlarıyla görüşme yapıyor; kayıtları
-- öğrenci kartında tutulacak. Görüşmeci serbest metin (psikologlar sistemde
-- kullanıcı değil), türü etiket (sayılabilsin diye). Notlar sağlık bilgisi
-- gibi hassas: stajyer sorgularına hiç girmez.
CREATE TYPE "CounselorType" AS ENUM ('PSIKOLOG', 'KOORDINATOR');

CREATE TABLE "CounselingSession" (
  "id"              TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "date"            DATE NOT NULL,
  "counselorName"   TEXT NOT NULL,
  "counselorType"   "CounselorType" NOT NULL,
  "notes"           TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CounselingSession_pkey" PRIMARY KEY ("id")
);

-- Cascade: öğrenci silinirse görüşmeleri de gider (uygulama katmanı görüşmeli
-- öğrencinin silinmesini zaten engelliyor — puanlama/rapor engeliyle aynı ilke).
-- SetNull: kaydı giren hesap silinse de görüşme kaydı kalır.
ALTER TABLE "CounselingSession"
  ADD CONSTRAINT "CounselingSession_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CounselingSession"
  ADD CONSTRAINT "CounselingSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CounselingSession_studentId_date_idx"
  ON "CounselingSession"("studentId", "date");
