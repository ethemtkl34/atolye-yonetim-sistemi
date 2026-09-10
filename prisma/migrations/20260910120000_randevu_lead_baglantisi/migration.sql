ALTER TABLE "Randevu" ADD COLUMN "leadId" TEXT;
CREATE INDEX "Randevu_leadId_idx" ON "Randevu"("leadId");
ALTER TABLE "Randevu" ADD CONSTRAINT "Randevu_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
