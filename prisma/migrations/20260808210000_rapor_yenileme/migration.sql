-- §11 rapor yenilemesi.
--
-- Dört şey ekleniyor:
--   1. Gözlem notları (oturum bazlı + kayıt bazlı) — rapordaki beceri
--      bloklarının tek veri kaynağı.
--   2. Atölye içerik paragrafları — öğrenciye özel DEĞİL, program × atölye.
--   3. Beceri tanımları sözlüğü — raporda basılan sabit tanım metinleri.
--   4. Öneri ürünleri kataloğu — ev önerilerinin kapalı listesi.

-- 1. Gözlem notları ------------------------------------------------------
ALTER TABLE "Score" ADD COLUMN "gozlemNotu" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN "gozlemNotu" TEXT;

-- Rapor kapağındaki eğitim yılı.
ALTER TABLE "Term" ADD COLUMN "egitimYili" TEXT;

-- 2. Atölye içerik paragrafları -------------------------------------------
CREATE TABLE "AtolyeIcerigi" (
    "id" TEXT NOT NULL,
    "termId" TEXT,
    "clubId" TEXT,
    "workshopTypeId" TEXT NOT NULL,
    "metin" TEXT NOT NULL,
    "kaynak" TEXT NOT NULL DEFAULT 'ai',
    "kilitli" BOOLEAN NOT NULL DEFAULT false,
    "uretenUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtolyeIcerigi_pkey" PRIMARY KEY ("id")
);

-- CurriculumEntry ile aynı kural: dönem VEYA kulüp, tam olarak biri dolu.
ALTER TABLE "AtolyeIcerigi" ADD CONSTRAINT "AtolyeIcerigi_donem_xor_kulup"
    CHECK (("termId" IS NULL) <> ("clubId" IS NULL));

CREATE UNIQUE INDEX "AtolyeIcerigi_termId_workshopTypeId_key"
    ON "AtolyeIcerigi"("termId", "workshopTypeId");
CREATE UNIQUE INDEX "AtolyeIcerigi_clubId_workshopTypeId_key"
    ON "AtolyeIcerigi"("clubId", "workshopTypeId");

ALTER TABLE "AtolyeIcerigi" ADD CONSTRAINT "AtolyeIcerigi_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtolyeIcerigi" ADD CONSTRAINT "AtolyeIcerigi_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtolyeIcerigi" ADD CONSTRAINT "AtolyeIcerigi_workshopTypeId_fkey"
    FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AtolyeIcerigi" ADD CONSTRAINT "AtolyeIcerigi_uretenUserId_fkey"
    FOREIGN KEY ("uretenUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Beceri tanımları sözlüğü ----------------------------------------------
CREATE TABLE "BeceriTanimi" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tanim" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeceriTanimi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BeceriTanimi_ad_key" ON "BeceriTanimi"("ad");
CREATE INDEX "BeceriTanimi_active_sortOrder_idx" ON "BeceriTanimi"("active", "sortOrder");

-- 4. Öneri ürünleri kataloğu -----------------------------------------------
CREATE TABLE "OneriUrunu" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "yasMin" INTEGER NOT NULL,
    "yasMax" INTEGER NOT NULL,
    "alanlar" TEXT[],
    "beceriler" TEXT[],
    "aciklama" TEXT,
    "workshopTypeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneriUrunu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OneriUrunu_active_yasMin_yasMax_idx" ON "OneriUrunu"("active", "yasMin", "yasMax");

ALTER TABLE "OneriUrunu" ADD CONSTRAINT "OneriUrunu_workshopTypeId_fkey"
    FOREIGN KEY ("workshopTypeId") REFERENCES "WorkshopType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
