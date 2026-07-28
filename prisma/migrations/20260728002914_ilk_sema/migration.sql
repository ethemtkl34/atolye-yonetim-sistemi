-- CreateEnum
CREATE TYPE "Role" AS ENUM ('KOORDINATOR', 'STAJYER');

-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('TASLAK', 'KAYIT_ALIYOR', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'ARSIVLENDI');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('TASLAK', 'KAYIT_ALIYOR', 'TAMAMLANDI', 'IPTAL_EDILDI', 'ARSIVLENDI');

-- CreateEnum
CREATE TYPE "Day" AS ENUM ('CUMARTESI', 'PAZAR');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('OGLEDEN_ONCE', 'OGLEDEN_SONRA');

-- CreateEnum
CREATE TYPE "GuardianType" AS ENUM ('ANNE', 'BABA');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('AKTIF', 'IPTAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "workshopTypeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TermStatus" NOT NULL DEFAULT 'TASLAK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermWorkshop" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "workshopTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TermWorkshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermWeek" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "TermWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "ClubStatus" NOT NULL DEFAULT 'TASLAK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubWorkshop" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "workshopTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClubWorkshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "termId" TEXT,
    "clubId" TEXT,
    "name" TEXT NOT NULL,
    "day" "Day" NOT NULL,
    "timeSlot" "TimeSlot" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "startWeekNumber" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE,
    "school" TEXT,
    "grade" TEXT,
    "notes" TEXT,
    "searchName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "GuardianType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "searchPhone" TEXT,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthInfo" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "allergies" TEXT,
    "medications" TEXT,
    "specialEducation" TEXT,
    "healthNotes" TEXT,
    "emergencyInfo" TEXT,
    "internSafetyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "internId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "workshopTypeId" TEXT NOT NULL,
    "termWeekId" TEXT,
    "date" DATE NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "scoredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreAnswer" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "questionId" TEXT,
    "questionTextSnapshot" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "value" INTEGER,

    CONSTRAINT "ScoreAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bodyJson" JSONB NOT NULL,
    "editedByUserId" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportEnrollment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,

    CONSTRAINT "ReportEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPdf" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopType_name_key" ON "WorkshopType"("name");

-- CreateIndex
CREATE INDEX "WorkshopType_active_sortOrder_idx" ON "WorkshopType"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "Question_workshopTypeId_active_sortOrder_idx" ON "Question"("workshopTypeId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "Term_status_idx" ON "Term"("status");

-- CreateIndex
CREATE INDEX "TermWorkshop_termId_sortOrder_idx" ON "TermWorkshop"("termId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TermWorkshop_termId_workshopTypeId_key" ON "TermWorkshop"("termId", "workshopTypeId");

-- CreateIndex
CREATE INDEX "TermWeek_termId_weekNumber_idx" ON "TermWeek"("termId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TermWeek_termId_weekNumber_key" ON "TermWeek"("termId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TermWeek_termId_date_key" ON "TermWeek"("termId", "date");

-- CreateIndex
CREATE INDEX "Club_status_idx" ON "Club"("status");

-- CreateIndex
CREATE INDEX "ClubWorkshop_clubId_sortOrder_idx" ON "ClubWorkshop"("clubId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ClubWorkshop_clubId_workshopTypeId_key" ON "ClubWorkshop"("clubId", "workshopTypeId");

-- CreateIndex
CREATE INDEX "Group_termId_idx" ON "Group"("termId");

-- CreateIndex
CREATE INDEX "Group_clubId_idx" ON "Group"("clubId");

-- CreateIndex
CREATE INDEX "Group_day_timeSlot_idx" ON "Group"("day", "timeSlot");

-- CreateIndex
CREATE INDEX "Student_searchName_idx" ON "Student"("searchName");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Guardian_searchPhone_idx" ON "Guardian"("searchPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_studentId_type_key" ON "Guardian"("studentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "HealthInfo_studentId_key" ON "HealthInfo"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_groupId_status_idx" ON "Enrollment"("groupId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_internId_status_idx" ON "Enrollment"("internId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_groupId_key" ON "Enrollment"("studentId", "groupId");

-- CreateIndex
CREATE INDEX "Session_groupId_date_idx" ON "Session"("groupId", "date");

-- CreateIndex
CREATE INDEX "Session_date_idx" ON "Session"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Session_groupId_date_workshopTypeId_key" ON "Session"("groupId", "date", "workshopTypeId");

-- CreateIndex
CREATE INDEX "Score_enrollmentId_idx" ON "Score"("enrollmentId");

-- CreateIndex
CREATE INDEX "Score_updatedAt_idx" ON "Score"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Score_sessionId_enrollmentId_key" ON "Score"("sessionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ScoreAnswer_scoreId_sortOrder_idx" ON "ScoreAnswer"("scoreId", "sortOrder");

-- CreateIndex
CREATE INDEX "Report_studentId_generatedAt_idx" ON "Report"("studentId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportEnrollment_reportId_enrollmentId_key" ON "ReportEnrollment"("reportId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ReportPdf_reportId_createdAt_idx" ON "ReportPdf"("reportId", "createdAt");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_workshopTypeId_fkey" FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermWorkshop" ADD CONSTRAINT "TermWorkshop_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermWorkshop" ADD CONSTRAINT "TermWorkshop_workshopTypeId_fkey" FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermWeek" ADD CONSTRAINT "TermWeek_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubWorkshop" ADD CONSTRAINT "ClubWorkshop_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubWorkshop" ADD CONSTRAINT "ClubWorkshop_workshopTypeId_fkey" FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthInfo" ADD CONSTRAINT "HealthInfo_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_internId_fkey" FOREIGN KEY ("internId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_workshopTypeId_fkey" FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_termWeekId_fkey" FOREIGN KEY ("termWeekId") REFERENCES "TermWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAnswer" ADD CONSTRAINT "ScoreAnswer_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAnswer" ADD CONSTRAINT "ScoreAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_editedByUserId_fkey" FOREIGN KEY ("editedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEnrollment" ADD CONSTRAINT "ReportEnrollment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEnrollment" ADD CONSTRAINT "ReportEnrollment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPdf" ADD CONSTRAINT "ReportPdf_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Elle eklenen CHECK kısıtları
--
-- Prisma şeması bu kuralları ifade edemiyor. Uygulama katmanı da aynı kuralları
-- doğruluyor; buradakiler son savunma hattı: hatalı bir sorgu veya elle atılan
-- bir SQL bozuk veri yazamasın diye.
-- ---------------------------------------------------------------------------

-- §2.3 — Bir grup ya döneme ya kulübe aittir; ikisine birden veya hiçbirine
-- ait olamaz.
ALTER TABLE "Group" ADD CONSTRAINT "Group_term_xor_club"
  CHECK (("termId" IS NOT NULL AND "clubId" IS NULL)
      OR ("termId" IS NULL AND "clubId" IS NOT NULL));

-- Kontenjan en az 1 olmalı; 0 veya negatif kontenjanlı grup anlamsız.
ALTER TABLE "Group" ADD CONSTRAINT "Group_capacity_pozitif"
  CHECK ("capacity" > 0);

-- §13.1 — Dönem 10 eğitim haftasından oluşur.
ALTER TABLE "Group" ADD CONSTRAINT "Group_startWeekNumber_araligi"
  CHECK ("startWeekNumber" BETWEEN 1 AND 10);

ALTER TABLE "TermWeek" ADD CONSTRAINT "TermWeek_weekNumber_araligi"
  CHECK ("weekNumber" BETWEEN 1 AND 10);

-- §10.3 — Puan 1–5 arasıdır. NULL "Değerlendirilemedi" anlamına gelir ve
-- geçerli bir değerdir; 0 veya 6 değildir.
ALTER TABLE "ScoreAnswer" ADD CONSTRAINT "ScoreAnswer_value_araligi"
  CHECK ("value" IS NULL OR "value" BETWEEN 1 AND 5);
