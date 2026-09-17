-- Dış sistemden (AppSheet) aktarılan randevunun kaynak kimliği.
ALTER TABLE "Randevu" ADD COLUMN "disKaynakId" TEXT;

CREATE UNIQUE INDEX "Randevu_disKaynakId_key" ON "Randevu"("disKaynakId");
