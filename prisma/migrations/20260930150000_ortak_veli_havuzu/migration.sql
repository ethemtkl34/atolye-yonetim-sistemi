-- Ortak veli havuzu (30 Eylül 2026).
--
-- Öğrenciler iki şubede ortak havuza alındı; veli de onlarla birlikte ortak
-- oluyor. `Veli.branchId` kayıt şubesi ETİKETİ olarak kalıyor, kimlik
-- anahtarı ise "şube + telefon + ad" yerine "telefon + ad".
--
-- Önce iki şubede aynı telefon ve aynı adla ayrı ayrı açılmış veliler
-- birleştirilir: en eski kayıt kalır, diğerlerinin öğrenci bağları ve
-- randevuları ona taşınır, boşalan kopyalar silinir. Yalnız telefon DEĞİL,
-- telefon + ad birebir aynı olmalı (anne ile baba aynı numarayı paylaşabiliyor;
-- bkz. şemadaki `Veli` notu). Telefonsuz veliler kısıtın dışında, dokunulmaz.
--
-- Birleşen bir veli aynı çocuğa iki kez (anne VE baba olarak) bağlıysa bağ
-- tablosu `[studentId, type]` ile tekil olduğu için çakışma olmaz — iki bağ
-- farklı türde. Aynı türde iki bağ zaten tekillik gereği var olamaz.

CREATE TEMP TABLE veli_birlesme AS
SELECT v.id AS eski_id,
       first_value(v.id) OVER (
         PARTITION BY v."searchPhone", v."searchName"
         ORDER BY v."createdAt", v.id
       ) AS kalan_id
FROM "Veli" v
WHERE v."searchPhone" IS NOT NULL
  AND (v."searchPhone", v."searchName") IN (
    SELECT "searchPhone", "searchName" FROM "Veli"
    WHERE "searchPhone" IS NOT NULL
    GROUP BY 1, 2 HAVING count(*) > 1
  );

DELETE FROM veli_birlesme WHERE eski_id = kalan_id;

UPDATE "Guardian" g SET "veliId" = b.kalan_id
  FROM veli_birlesme b WHERE g."veliId" = b.eski_id;

UPDATE "Randevu" r SET "veliId" = b.kalan_id
  FROM veli_birlesme b WHERE r."veliId" = b.eski_id;

-- Kopyanın notu kaybolmasın: kalan kayıtta not yoksa kopyanınki taşınır.
UPDATE "Veli" k SET notes = e.notes
  FROM veli_birlesme b JOIN "Veli" e ON e.id = b.eski_id
  WHERE k.id = b.kalan_id AND k.notes IS NULL AND e.notes IS NOT NULL;

DELETE FROM "Veli" v USING veli_birlesme b WHERE v.id = b.eski_id;

DROP INDEX "Veli_branchId_searchPhone_searchName_key";
CREATE UNIQUE INDEX "Veli_searchPhone_searchName_key" ON "Veli"("searchPhone", "searchName");
