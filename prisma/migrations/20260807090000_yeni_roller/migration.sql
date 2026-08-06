-- Rol katmanı revizyonu: üç yeni rol eklenir.
--
-- BU DOSYADA BAŞKA HİÇBİR ŞEY OLMAMALI. PostgreSQL'de `ALTER TYPE ... ADD VALUE`
-- ile eklenen değer, aynı transaction içinde KULLANILAMAZ; Prisma ise her
-- migration dosyasını tek transaction'da çalıştırır. Yeni değerleri kullanan
-- backfill ve CHECK kısıtları bir sonraki migration'da (20260802090000_rol_admin
-- emsalindeki kural).
ALTER TYPE "Role" ADD VALUE 'ATOLYE_PSIKOLOGU';
ALTER TYPE "Role" ADD VALUE 'TEST_UYGULAYICISI';
ALTER TYPE "Role" ADD VALUE 'DANISMA_GOREVLISI';
