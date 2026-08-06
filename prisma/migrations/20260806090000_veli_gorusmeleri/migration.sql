-- Veli görüşmeleri.
--
-- Dönem sürecinde veli "nasıl gidiyor" görüşmesine geliyor; görüşmeyi yapacak
-- kişiye öğrencinin puanlamalarından ve 3 soruluk mini testten bir brief
-- hazırlanıyor. Kayıt görüşmeden ÖNCE açılır (gelecek tarih geçerli), serbest
-- görüşme notu görüşmeden SONRA eklenir. Öğrenci görüşmelerinden
-- (CounselingSession) ayrı tablo: yaşam döngüleri zıt.
-- GİZLİLİK: veli görüşmeleri de stajyer sorgularına hiç girmez.
CREATE TABLE "ParentMeeting" (
  "id"              TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "date"            DATE NOT NULL,
  "interviewerName" TEXT NOT NULL,
  "answersJson"     JSONB NOT NULL,
  "briefJson"       JSONB NOT NULL,
  "note"            TEXT,
  "noteUpdatedAt"   TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentMeeting_pkey" PRIMARY KEY ("id")
);

-- Cascade: öğrenci silinirse görüşmeleri de gider (uygulama katmanı görüşmeli
-- öğrencinin silinmesini zaten engelliyor — CounselingSession ile aynı ilke).
-- SetNull: kaydı giren hesap silinse de görüşme kaydı kalır.
ALTER TABLE "ParentMeeting"
  ADD CONSTRAINT "ParentMeeting_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentMeeting"
  ADD CONSTRAINT "ParentMeeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ParentMeeting_studentId_date_idx"
  ON "ParentMeeting"("studentId", "date");

-- Prisma'nın ifade edemediği kural: not olmadan not damgası olamaz. Not
-- silinip damga unutulursa "notu olmayan ama güncellenmiş" çelişkili satır
-- kalırdı; kısıt bunu veritabanı seviyesinde keser.
ALTER TABLE "ParentMeeting" ADD CONSTRAINT "ParentMeeting_not_damgasi"
  CHECK ("note" IS NOT NULL OR "noteUpdatedAt" IS NULL);
