-- Terapi türü listesi kurumun yürüttüğü hizmetlere göre yenilendi.
--
-- Eski liste iki türdü (oyun / danışan terapisi); kurum altı tür yürütüyor.
-- "Danışan terapisi" karşılıksız kaldı — yeni listede eşleneceği bir tür yok
-- ve o etiketle girilmiş tek kayıt kurum kararıyla siliniyor (bu ayrım
-- konmadan önce girilmiş, serbest not biçimindeki eski bir kayıttı).
DELETE FROM "CounselingSession" WHERE "therapyType" = 'DANISAN_TERAPISI';

-- PostgreSQL enum'dan değer düşürmeye izin vermiyor; tip yenisiyle
-- değiştiriliyor. Kolon `text` üzerinden dönüştürülür — kalan bütün satırlar
-- OYUN_TERAPISI ve bu değer yeni tipte de var, dönüşüm kayıpsız.
CREATE TYPE "TherapyType_yeni" AS ENUM (
  'OYUN_TERAPISI',
  'ERGEN_TERAPISI',
  'ERGOTERAPI',
  'BILISSEL_MUDAHALE',
  'KISA_AILE_DANISMANLIGI',
  'UZUN_AILE_DANISMANLIGI'
);

ALTER TABLE "CounselingSession"
  ALTER COLUMN "therapyType" TYPE "TherapyType_yeni"
  USING ("therapyType"::text::"TherapyType_yeni");

DROP TYPE "TherapyType";
ALTER TYPE "TherapyType_yeni" RENAME TO "TherapyType";
