-- Role enum'una ADMIN eklenir.
--
-- BU DOSYADA BAŞKA HİÇBİR ŞEY OLMAMALI. PostgreSQL'de `ALTER TYPE ... ADD VALUE`
-- ile eklenen değer, aynı transaction içinde KULLANILAMAZ; Prisma ise her
-- migration dosyasını tek transaction'da çalıştırır. ADMIN'i kullanan CHECK
-- kısıtı ve INSERT'ler bir sonraki migration'da. Aksi hâlde yerelde çalışan
-- migration üretimde `migrate deploy` sırasında patlar.
ALTER TYPE "Role" ADD VALUE 'ADMIN';
