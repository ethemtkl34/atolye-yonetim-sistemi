-- §17.1 — Veli birinci sınıf kayıt oluyor.
--
-- Eskiden veli kimliği `Guardian` satırının içindeydi: ad + telefon,
-- öğrencinin altında, `@@unique([studentId, type])`. O modelde aynı anne-baba
-- her çocuğu için AYRI bir satırdı. Bu migration yazıldığında canlıda 857
-- guardian satırı ve 750 benzersiz telefon vardı — yani en az 58 veli sistemde
-- ikiye bölünmüş durumdaydı.
--
-- Randevu (§17.4) velinin kendisine açıldığı için bu bölünme velinin randevu
-- geçmişini çocukları arasında paylaştırırdı. Kimlik `Veli`ye taşınıyor,
-- `Guardian` yalnızca "hangi veli, hangi çocuğun annesi/babası" bağını
-- tutan tabloya indirgeniyor.
--
-- BİRLEŞTİRME ANAHTARI: (şube, telefon, normalize ad).
--
-- Yalnız telefon DENENDİ ve yanlış çıktı: canlı verinin bir kopyası üzerinde
-- koşturulduğunda beş telefonun iki farklı ada bağlı olduğu görüldü ve
-- bunların ikisi gerçekten iki ayrı kişiydi — anne ile baba aynı telefonu
-- paylaşıyordu (Derya/Eyüp ve Zeynep/İhsan). Telefona göre birleştirmek
-- babanın adını siliyordu. Telefon bir cihaz, kimlik değil.
--
-- Ada da bakmanın bedeli: aynı kişinin iki farklı yazımı (Burhan/Burhanettin,
-- Meryem/Meryem Ebru, Esma/Esra) ayrı kayıt olarak kalıyor — 750 yerine 755
-- telefonlu veli. Kozmetik bir mükerrer, elle birleştirilebilir; silinen bir
-- ad geri gelmez.
--
-- Telefonsuz satırların her biri kendi velisi olur: eşleştirilecek bir şey
-- yok ve Postgres'te NULL'lar birbirine eşit sayılmadığı için tekil kısıt da
-- bunlara dokunmaz.

CREATE TABLE "Veli" (
  "id"          TEXT NOT NULL,
  "branchId"    TEXT NOT NULL,
  "fullName"    TEXT NOT NULL,
  "phone"       TEXT,
  "searchPhone" TEXT,
  "searchName"  TEXT NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Veli_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Veli"
  ADD CONSTRAINT "Veli_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Türkçe "İ" TUZAĞI: veritabanının `lower()` işlevi Türkçe yerelde çalışmıyor
-- ve 'İ' harfini birleşik noktalı bir 'i̇'ye çeviriyor — uygulamadaki
-- `normalizeArama` (toLocaleLowerCase("tr-TR")) ise düz 'i' üretir. İki yazım
-- eşleşmez ve "İhsan" adlı veli aramada hiç bulunamazdı. Bu yüzden 'İ' ve 'I'
-- harfleri lower()'dan ÖNCE elle çevriliyor. Bu ifade `src/lib/turkce.ts`
-- içindeki `normalizeArama` ile aynı sonucu vermek zorunda.
CREATE FUNCTION pg_temp.normalize_arama(metin TEXT) RETURNS TEXT AS $$
  SELECT btrim(regexp_replace(
    translate(lower(translate(metin, 'İI', 'iı')), 'çğıöşüâîû', 'cgiosuaiu'),
    '\s+', ' ', 'g'
  ));
$$ LANGUAGE SQL IMMUTABLE;

-- --------------------------------------------------------------------------
-- Taşıma
-- --------------------------------------------------------------------------

ALTER TABLE "Guardian" ADD COLUMN "veliId" TEXT;

-- 1) Telefonu olanlar: (şube, telefon, normalize ad) başına TEK veli.
--    Hangi yazımın alınacağını en erken oluşturulmuş öğrenci belirler —
--    keyfi ama kararlı.
INSERT INTO "Veli" ("id", "branchId", "fullName", "phone", "searchPhone", "searchName", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t."branchId",
  t."fullName",
  t."phone",
  t."searchPhone",
  t."searchName",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (s."branchId", g."searchPhone", pg_temp.normalize_arama(g."fullName"))
    s."branchId",
    g."searchPhone",
    pg_temp.normalize_arama(g."fullName") AS "searchName",
    g."fullName",
    g."phone"
  FROM "Guardian" g
  JOIN "Student" s ON s."id" = g."studentId"
  WHERE g."searchPhone" IS NOT NULL AND g."searchPhone" <> ''
  ORDER BY s."branchId", g."searchPhone", pg_temp.normalize_arama(g."fullName"), s."createdAt", g."id"
) t;

UPDATE "Guardian" g
SET "veliId" = v."id"
FROM "Student" s, "Veli" v
WHERE s."id" = g."studentId"
  AND v."branchId" = s."branchId"
  AND v."searchPhone" = g."searchPhone"
  AND v."searchName" = pg_temp.normalize_arama(g."fullName")
  AND g."searchPhone" IS NOT NULL AND g."searchPhone" <> '';

-- 2) Telefonsuzlar: her satır kendi velisi. Guardian id'si Veli id'si olarak
--    yeniden kullanılıyor — eşleme tek adımda kuruluyor ve id zaten tekil.
INSERT INTO "Veli" ("id", "branchId", "fullName", "phone", "searchPhone", "searchName", "updatedAt")
SELECT
  g."id",
  s."branchId",
  g."fullName",
  g."phone",
  NULL,
  pg_temp.normalize_arama(g."fullName"),
  CURRENT_TIMESTAMP
FROM "Guardian" g
JOIN "Student" s ON s."id" = g."studentId"
WHERE g."searchPhone" IS NULL OR g."searchPhone" = '';

UPDATE "Guardian" g
SET "veliId" = g."id"
WHERE g."veliId" IS NULL;

-- --------------------------------------------------------------------------
-- Kısıtlar ve Guardian'ın bağ tablosuna indirgenmesi
-- --------------------------------------------------------------------------

-- Telefonu OLAN veliler şube içinde ad+telefon ikilisiyle tekil.
-- Telefonsuzlar kısıtın dışında: NULL'lar birbirine eşit sayılmaz.
CREATE UNIQUE INDEX "Veli_branchId_searchPhone_searchName_key"
  ON "Veli"("branchId", "searchPhone", "searchName");
CREATE INDEX "Veli_branchId_searchName_idx" ON "Veli"("branchId", "searchName");

ALTER TABLE "Guardian" ALTER COLUMN "veliId" SET NOT NULL;

ALTER TABLE "Guardian"
  ADD CONSTRAINT "Guardian_veliId_fkey"
  FOREIGN KEY ("veliId") REFERENCES "Veli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Guardian_veliId_idx" ON "Guardian"("veliId");

DROP INDEX IF EXISTS "Guardian_searchPhone_idx";
ALTER TABLE "Guardian" DROP COLUMN "fullName";
ALTER TABLE "Guardian" DROP COLUMN "phone";
ALTER TABLE "Guardian" DROP COLUMN "searchPhone";
