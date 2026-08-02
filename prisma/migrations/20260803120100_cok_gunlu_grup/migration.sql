-- Hafta içi dönemler ve çok günlü gruplar.
--
-- Üç değişiklik birbirine bağlı olduğu için tek migration:
--   1. Dönem hangi günlerde toplanıyor (`Term.dayMode`)
--   2. Grup haftada birden çok gün toplanabiliyor (`Group.day` → `days`)
--   3. Hafta çapası cumartesiden pazartesiye kayıyor (`TermWeek.date`)

CREATE TYPE "DayMode" AS ENUM ('HAFTA_SONU', 'HAFTA_ICI');

-- Mevcut dönemlerin hepsi hafta sonu; varsayılan bu yüzden HAFTA_SONU.
ALTER TABLE "Term" ADD COLUMN "dayMode" "DayMode" NOT NULL DEFAULT 'HAFTA_SONU';

-- Grup günü tek alandan listeye dönüyor. Yaz programlarında bir grup haftada
-- birden çok gün toplanıyor ve her gün bütün atölyeler yapılıyor.
ALTER TABLE "Group" ADD COLUMN "days" "Day"[] NOT NULL DEFAULT ARRAY[]::"Day"[];
UPDATE "Group" SET "days" = ARRAY["day"]::"Day"[];
ALTER TABLE "Group" ALTER COLUMN "days" DROP DEFAULT;

DROP INDEX IF EXISTS "Group_day_timeSlot_idx";
ALTER TABLE "Group" DROP COLUMN "day";

-- Günsüz grup anlamsız: oturum üretilemez, takvimde yeri olmaz.
ALTER TABLE "Group"
  ADD CONSTRAINT "Group_gun_dolu" CHECK (array_length("days", 1) >= 1);

-- Hafta çapası artık PAZARTESİ.
--
-- Eskiden cumartesiydi ve pazar grubunun tarihi "çapa + 1" diye bulunuyordu;
-- hafta içi günler bu hesaba sığmıyor. Çapa haftanın başına alınınca yedi gün
-- de aynı formülden çıkıyor: çapa + günün sırası.
--
-- Cumartesi − 5 gün = AYNI haftanın pazartesisi, dolayısıyla pazar grupları da
-- (çapa + 6) eskisiyle aynı tarihe düşüyor. Üretilmiş `Session` satırlarının
-- tarihleri gerçek toplanma günü olduğu için onlara dokunulmuyor.
UPDATE "TermWeek" SET "date" = "date" - INTERVAL '5 days';
