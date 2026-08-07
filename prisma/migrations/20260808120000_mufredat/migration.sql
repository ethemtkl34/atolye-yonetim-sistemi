-- Haftalık müfredat: CurriculumEntry tablosu + öğretmen adı sütunları.

ALTER TABLE "TermWorkshop" ADD COLUMN "teacherName" TEXT;
ALTER TABLE "ClubWorkshop" ADD COLUMN "teacherName" TEXT;

-- CreateTable
CREATE TABLE "CurriculumEntry" (
    "id" TEXT NOT NULL,
    "termId" TEXT,
    "clubId" TEXT,
    "workshopTypeId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumEntry_termId_weekNumber_workshopTypeId_key" ON "CurriculumEntry"("termId", "weekNumber", "workshopTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumEntry_clubId_weekNumber_workshopTypeId_key" ON "CurriculumEntry"("clubId", "weekNumber", "workshopTypeId");

-- AddForeignKey
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_workshopTypeId_fkey" FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Elle eklenen CHECK kısıtları — Prisma şemada ifade edemiyor
-- (Group_term_xor_club emsali).
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_term_xor_club"
  CHECK (("termId" IS NOT NULL AND "clubId" IS NULL)
      OR ("termId" IS NULL AND "clubId" IS NOT NULL));

ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_hafta_pozitif"
  CHECK ("weekNumber" >= 1);
