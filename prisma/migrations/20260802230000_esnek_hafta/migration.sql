-- Kulüp haftalara yayılabilsin, hafta sayısı serbest olsun.
--
-- Kulüp tek yarım gündü (`Club.date`). Artık dönem gibi birden çok hafta
-- sürebiliyor ve hafta sayısı sabit değil. `date` KALDIRILMADI: listeler,
-- kartlar ve sıralama tek bir tarih üzerinden çalışıyor; artık "ilk toplanma
-- günü" anlamına geliyor ve `weekDates`'in ilk elemanıyla eşit tutuluyor.
--
-- Ayrı bir `ClubWeek` tablosu açılmadı: kulüp haftasına bağlanan başka kayıt
-- yok, liste yalnızca grup açılırken oturum üretmek için okunuyor.
ALTER TABLE "Club" ADD COLUMN "weekDates" DATE[] NOT NULL DEFAULT ARRAY[]::DATE[];

-- Mevcut kulüpler tek günlük: o gün listenin tek elemanı olur.
UPDATE "Club" SET "weekDates" = ARRAY["date"]::DATE[] WHERE "weekDates" = '{}';

-- Oturumun hafta numarası GÖSTERİM için; dönemde `TermWeek`'ten okunuyordu
-- ama kulüpte öyle bir bağ yok. Telafi günlerinde boş kalır.
ALTER TABLE "Session" ADD COLUMN "weekNumber" INTEGER;

-- Mevcut dönem oturumlarının numarası bağlı oldukları haftadan doldurulur;
-- kulüp oturumları (tek gün) 1. hafta sayılır.
UPDATE "Session" s
   SET "weekNumber" = w."weekNumber"
  FROM "TermWeek" w
 WHERE s."termWeekId" = w."id";

UPDATE "Session" s
   SET "weekNumber" = 1
  FROM "Group" g
 WHERE s."groupId" = g."id"
   AND g."clubId" IS NOT NULL
   AND s."weekNumber" IS NULL;
