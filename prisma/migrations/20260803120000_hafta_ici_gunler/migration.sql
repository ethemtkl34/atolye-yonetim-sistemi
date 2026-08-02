-- Day enum'una hafta içi günleri eklenir.
--
-- BU DOSYADA BAŞKA HİÇBİR ŞEY OLMAMALI. PostgreSQL'de `ALTER TYPE ... ADD
-- VALUE` ile eklenen değer aynı transaction içinde KULLANILAMAZ; Prisma ise
-- her migration dosyasını tek transaction'da çalıştırır. Yeni günleri kullanan
-- sütun ve veri taşıma bir sonraki migration'da (bkz. rol_admin migration'ında
-- aynı tuzak).
--
-- `BEFORE 'CUMARTESI'` ile sıra takvim sırası oluyor: pazartesi → pazar.
-- Enum sırası görüntü meselesi değil, `orderBy` bu sıraya güveniyor.
ALTER TYPE "Day" ADD VALUE 'PAZARTESI' BEFORE 'CUMARTESI';
ALTER TYPE "Day" ADD VALUE 'SALI'      BEFORE 'CUMARTESI';
ALTER TYPE "Day" ADD VALUE 'CARSAMBA'  BEFORE 'CUMARTESI';
ALTER TYPE "Day" ADD VALUE 'PERSEMBE'  BEFORE 'CUMARTESI';
ALTER TYPE "Day" ADD VALUE 'CUMA'      BEFORE 'CUMARTESI';
