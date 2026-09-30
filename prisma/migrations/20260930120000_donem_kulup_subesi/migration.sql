-- Dönem ve kulüp şubeye ait (30 Eylül 2026).
--
-- Önceden dönem ve kulüp iki şubede ORTAKTI; şube sınırı yalnız grupta
-- duruyordu. Kurum her şubenin kendi dönemini ve kulübünü açmasını istedi —
-- tarihleri aynı olsa bile. Bu migration:
--
--   1. `Term` ve `Club` tablolarına `branchId` ekler,
--   2. yalnız TEK şubede grubu olan programı o şubeye yazar,
--   3. İKİ şubede grubu olan programı böler: asıl satır Ümraniye'de kalır,
--      Güneşli için birebir kopya açılır (haftalar, atölyeler, müfredat,
--      atölye içerikleri kopyalanır) ve Güneşli'nin grupları, dönem
--      kadrosundaki Güneşli stajyerleri ve oturumların hafta bağları
--      kopyaya taşınır,
--   4. sütunu zorunlu yapar.
--
-- Grubu hiç olmayan program kalmadı (kontrol edildi) ama olursa kadrosundaki
-- ilk stajyerin şubesine, o da yoksa Ümraniye'ye yazılır.
--
-- Kimlikler Prisma'nın cuid'i değil ama aynı biçimde (c + 24 hane) — uygulama
-- kimliğin içeriğine bakmıyor, yalnız benzersizliğine güveniyor.

ALTER TABLE "Term" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Club" ADD COLUMN "branchId" TEXT;

CREATE FUNCTION pg_temp.yeni_kimlik() RETURNS TEXT AS $$
  SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);
$$ LANGUAGE sql VOLATILE;

DO $$
DECLARE
  asil_sube CONSTANT TEXT := 'sube_umraniye';
  t RECORD;
  c RECORD;
  b TEXT;
  subeler TEXT[];
  yeni_id TEXT;
BEGIN
  -- ------------------------------------------------------------ Dönemler
  FOR t IN SELECT * FROM "Term" LOOP
    SELECT array_agg(DISTINCT g."branchId" ORDER BY g."branchId" DESC)
      INTO subeler
      FROM "Group" g WHERE g."termId" = t.id;

    IF subeler IS NULL THEN
      SELECT u."branchId" INTO b
        FROM "TermIntern" ti JOIN "User" u ON u.id = ti."userId"
        WHERE ti."termId" = t.id AND u."branchId" IS NOT NULL
        ORDER BY ti."createdAt" LIMIT 1;
      UPDATE "Term" SET "branchId" = COALESCE(b, asil_sube) WHERE id = t.id;
      CONTINUE;
    END IF;

    -- Asıl satır: Ümraniye grubu varsa Ümraniye, yoksa listedeki ilk şube.
    IF asil_sube = ANY (subeler) THEN
      b := asil_sube;
    ELSE
      b := subeler[1];
    END IF;
    UPDATE "Term" SET "branchId" = b WHERE id = t.id;

    FOREACH b IN ARRAY subeler LOOP
      CONTINUE WHEN b = (SELECT "branchId" FROM "Term" WHERE id = t.id);

      yeni_id := pg_temp.yeni_kimlik();
      INSERT INTO "Term" (id, name, description, status, "createdAt", "updatedAt",
                          "dayMode", "egitimYili", "gecmisVerisi", "branchId")
      VALUES (yeni_id, t.name, t.description, t.status, t."createdAt", now(),
              t."dayMode", t."egitimYili", t."gecmisVerisi", b);

      INSERT INTO "TermWorkshop" (id, "termId", "workshopTypeId", "sortOrder", "teacherName")
      SELECT pg_temp.yeni_kimlik(), yeni_id, "workshopTypeId", "sortOrder", "teacherName"
        FROM "TermWorkshop" WHERE "termId" = t.id;

      INSERT INTO "TermWeek" (id, "termId", "weekNumber", date)
      SELECT pg_temp.yeni_kimlik(), yeni_id, "weekNumber", date
        FROM "TermWeek" WHERE "termId" = t.id;

      INSERT INTO "CurriculumEntry" (id, "termId", "clubId", "workshopTypeId", "weekNumber",
                                     title, description, "createdAt", "updatedAt")
      SELECT pg_temp.yeni_kimlik(), yeni_id, NULL, "workshopTypeId", "weekNumber",
             title, description, "createdAt", now()
        FROM "CurriculumEntry" WHERE "termId" = t.id;

      INSERT INTO "AtolyeIcerigi" (id, "termId", "clubId", "workshopTypeId", metin, kaynak,
                                   kilitli, "uretenUserId", "createdAt", "updatedAt")
      SELECT pg_temp.yeni_kimlik(), yeni_id, NULL, "workshopTypeId", metin, kaynak,
             kilitli, "uretenUserId", "createdAt", now()
        FROM "AtolyeIcerigi" WHERE "termId" = t.id;

      -- Dönem kadrosu: bu şubenin stajyerleri kopyaya geçer.
      UPDATE "TermIntern" ti SET "termId" = yeni_id
        FROM "User" u
        WHERE ti."userId" = u.id AND ti."termId" = t.id AND u."branchId" = b;

      -- Oturumların hafta bağı, aynı hafta numarasıyla kopyanın haftasına.
      UPDATE "Session" s SET "termWeekId" = yeni_hafta.id
        FROM "Group" g, "TermWeek" eski_hafta, "TermWeek" yeni_hafta
        WHERE s."groupId" = g.id
          AND g."termId" = t.id AND g."branchId" = b
          AND s."termWeekId" = eski_hafta.id
          AND yeni_hafta."termId" = yeni_id
          AND yeni_hafta."weekNumber" = eski_hafta."weekNumber";

      UPDATE "Group" SET "termId" = yeni_id
        WHERE "termId" = t.id AND "branchId" = b;
    END LOOP;
  END LOOP;

  -- ------------------------------------------------------------ Kulüpler
  FOR c IN SELECT * FROM "Club" LOOP
    SELECT array_agg(DISTINCT g."branchId" ORDER BY g."branchId" DESC)
      INTO subeler
      FROM "Group" g WHERE g."clubId" = c.id;

    IF subeler IS NULL THEN
      UPDATE "Club" SET "branchId" = asil_sube WHERE id = c.id;
      CONTINUE;
    END IF;

    IF asil_sube = ANY (subeler) THEN
      b := asil_sube;
    ELSE
      b := subeler[1];
    END IF;
    UPDATE "Club" SET "branchId" = b WHERE id = c.id;

    FOREACH b IN ARRAY subeler LOOP
      CONTINUE WHEN b = (SELECT "branchId" FROM "Club" WHERE id = c.id);

      yeni_id := pg_temp.yeni_kimlik();
      INSERT INTO "Club" (id, name, date, description, status, "createdAt", "updatedAt",
                          "weekDates", "gecmisVerisi", "branchId")
      VALUES (yeni_id, c.name, c.date, c.description, c.status, c."createdAt", now(),
              c."weekDates", c."gecmisVerisi", b);

      INSERT INTO "ClubWorkshop" (id, "clubId", "workshopTypeId", "sortOrder", "teacherName")
      SELECT pg_temp.yeni_kimlik(), yeni_id, "workshopTypeId", "sortOrder", "teacherName"
        FROM "ClubWorkshop" WHERE "clubId" = c.id;

      INSERT INTO "CurriculumEntry" (id, "termId", "clubId", "workshopTypeId", "weekNumber",
                                     title, description, "createdAt", "updatedAt")
      SELECT pg_temp.yeni_kimlik(), NULL, yeni_id, "workshopTypeId", "weekNumber",
             title, description, "createdAt", now()
        FROM "CurriculumEntry" WHERE "clubId" = c.id;

      INSERT INTO "AtolyeIcerigi" (id, "termId", "clubId", "workshopTypeId", metin, kaynak,
                                   kilitli, "uretenUserId", "createdAt", "updatedAt")
      SELECT pg_temp.yeni_kimlik(), NULL, yeni_id, "workshopTypeId", metin, kaynak,
             kilitli, "uretenUserId", "createdAt", now()
        FROM "AtolyeIcerigi" WHERE "clubId" = c.id;

      UPDATE "Group" SET "clubId" = yeni_id
        WHERE "clubId" = c.id AND "branchId" = b;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "Term" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Club" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "Term" ADD CONSTRAINT "Term_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Club" ADD CONSTRAINT "Club_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Term_branchId_status_idx" ON "Term"("branchId", "status");
CREATE INDEX "Club_branchId_status_idx" ON "Club"("branchId", "status");
