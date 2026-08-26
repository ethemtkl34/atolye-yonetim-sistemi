-- Aday (CRM) tabloları — §16.
--
-- `Lead` şube sınırının dördüncü doğrudan tablosu (User/Group/Student'a ek):
-- aday daha öğrenci olmadan bir şubenin telefon listesine düşer, şubesi
-- türetilebileceği bir üst kayıt yok. `LeadActivity` görüşme kayıtları
-- ilkesiyle yazılır: silinmez, düzenlenmez.
--
-- İş kuralları uygulama katmanında (src/lib/aday-durumlari.ts geçiş haritası,
-- eylemlerdeki updateMany+count deseni) doğrulanır; buradaki CHECK'ler son
-- savunma hattıdır (Enrollment_iptal_alanlari deseni).

CREATE TABLE "Lead" (
  "id"                 TEXT NOT NULL,
  "branchId"           TEXT NOT NULL,
  "parentName"         TEXT,
  "childName"          TEXT,
  "childAge"           INTEGER,
  "phone"              TEXT,
  "searchPhone"        TEXT,
  "email"              TEXT,
  "searchName"         TEXT NOT NULL,
  "interestedProgram"  TEXT,
  "message"            TEXT,
  "source"             "LeadSource" NOT NULL,
  -- Kampanya/form adının anlık kopyası (questionTextSnapshot ilkesi).
  "sourceDetail"       TEXT,
  -- Meta leadgen kimliği: teslim tekrarlarında idempotency anahtarı.
  "externalId"         TEXT,
  "rawJson"            JSONB,
  "ingestStatus"       "LeadIngestStatus" NOT NULL DEFAULT 'TAMAM',
  "ingestNote"         TEXT,
  "kvkkConsent"        BOOLEAN NOT NULL DEFAULT false,
  "consentAt"          TIMESTAMP(3),
  "stage"              "LeadStage" NOT NULL DEFAULT 'YENI',
  "lossReason"         "LeadLossReason",
  "lossNote"           TEXT,
  "lostAt"             TIMESTAMP(3),
  "unreachableCount"   INTEGER NOT NULL DEFAULT 0,
  "lastContactAt"      TIMESTAMP(3),
  "appointmentAt"      TIMESTAMP(3),
  "nextActionDate"     DATE,
  "nextActionNote"     TEXT,
  "assignedToUserId"   TEXT,
  "convertedStudentId" TEXT,
  "convertedAt"        TIMESTAMP(3),
  "createdByUserId"    TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_externalId_key" ON "Lead"("externalId");
-- Bir öğrenci en fazla bir adaydan dönüşür (kaynak raporunun tekilliği).
CREATE UNIQUE INDEX "Lead_convertedStudentId_key" ON "Lead"("convertedStudentId");

-- Liste ekranının ana yolu: şube + aşama + takip tarihi ("bugün aranacaklar").
CREATE INDEX "Lead_branchId_stage_nextActionDate_idx" ON "Lead"("branchId", "stage", "nextActionDate");
-- Mükerrer kontrolü ve telefonla arama.
CREATE INDEX "Lead_branchId_searchPhone_idx" ON "Lead"("branchId", "searchPhone");
CREATE INDEX "Lead_branchId_searchName_idx" ON "Lead"("branchId", "searchName");
-- Kaynak raporu (createdAt kohortu).
CREATE INDEX "Lead_branchId_source_createdAt_idx" ON "Lead"("branchId", "source", "createdAt");

-- Şube kapanışı geçmiş aday verisini yok etmemeli (Branch ilkesi).
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sorumlu hesap silinse de aday kalır.
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Dönüştürülen öğrenci silinirse işaretçi kopar ama `convertedAt` damgası
-- kalır — kaynak raporu bozulmaz. CHECK bu yüzden damgadan okur, FK'dan değil.
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_convertedStudentId_fkey"
  FOREIGN KEY ("convertedStudentId") REFERENCES "Student"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Kaydı giren hesap silinse de aday kalır (görüşme kayıtlarındaki desen).
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Kayıp alanları yalnız KAYBEDILDI'de dolu; orada sebep + damga zorunlu.
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_kayip_alanlari" CHECK (
  ("stage" = 'KAYBEDILDI' AND "lossReason" IS NOT NULL AND "lostAt" IS NOT NULL)
  OR ("stage" <> 'KAYBEDILDI' AND "lossReason" IS NULL AND "lossNote" IS NULL AND "lostAt" IS NULL)
);

-- DIGER sebebinde açıklama zorunlu (CancelReason ilkesi).
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_kayip_diger_notu" CHECK (
  "lossReason" IS DISTINCT FROM 'DIGER' OR "lossNote" IS NOT NULL
);

-- KAZANILDI damgası convertedAt'tir: FK SetNull ile kopsa da damga kalır.
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_kazanildi_damgasi" CHECK (
  ("stage" = 'KAZANILDI') = ("convertedAt" IS NOT NULL)
);

-- Öğrenci bağlantısı yalnız kazanılmış adayda durabilir.
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_donusum_ogrencisi" CHECK (
  "convertedStudentId" IS NULL OR "stage" = 'KAZANILDI'
);

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_deneme_sayaci" CHECK (
  "unreachableCount" >= 0
);

CREATE TABLE "LeadActivity" (
  "id"              TEXT NOT NULL,
  "leadId"          TEXT NOT NULL,
  "type"            "LeadActivityType" NOT NULL,
  "note"            TEXT,
  "fromStage"       "LeadStage",
  "toStage"         "LeadStage",
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Aşama çifti yalnız ASAMA_DEGISIMI satırında ve orada zorunlu.
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_asama_alanlari" CHECK (
  ("type" = 'ASAMA_DEGISIMI' AND "fromStage" IS NOT NULL AND "toStage" IS NOT NULL)
  OR ("type" <> 'ASAMA_DEGISIMI' AND "fromStage" IS NULL AND "toStage" IS NULL)
);

-- Not türünde gövde zorunlu — boş not satırı gürültüdür.
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_not_govdesi" CHECK (
  "type" <> 'NOT' OR "note" IS NOT NULL
);
