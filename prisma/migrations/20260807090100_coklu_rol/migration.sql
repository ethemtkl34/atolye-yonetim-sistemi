-- Çoklu rol geçişi (expand aşaması).
--
-- Tek `role` sütunundan `roles` dizisine geçilir. Bir kullanıcı birden çok
-- unvan taşıyabilir ("Atölye Psikoloğu / Test Uygulayıcısı"); etkin yetki
-- rollerin birleşimidir (bkz. src/lib/yetkiler.ts).
--
-- İki fazlı geçiş: `role` sütunu bu migration'da KALDIRILMAZ, yalnızca
-- nullable yapılır. `vercel-build` migration'ı eski kod hâlâ yayındayken
-- uyguluyor; sütun hemen düşse deploy penceresinde eski kod kırılırdı.
-- Sistem canlıda doğrulandıktan sonra ayrı bir temizlik migration'ı sütunu
-- ve eski indeksleri düşürecek.

-- 1. Yeni sütunlar.
ALTER TABLE "User" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: mevcut tek rol, tek elemanlı diziye kopyalanır.
UPDATE "User" SET "roles" = ARRAY["role"]::"Role"[];

-- 3. Eski CHECK düşer: `role` sütununa bağlıydı. Artık yetkinin tek kaynağı
--    `roles`; bayat `role` değeriyle çelişen bir güncelleme (örn. yöneticiye
--    terfi) eski kısıta takılırdı.
ALTER TABLE "User" DROP CONSTRAINT "User_admin_sube_kurali";

-- 4. `role` artık yazılmıyor; temizlik migration'ına kadar nullable kalır.
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;

-- 5. Yeni CHECK kısıtları — uygulama katmanındaki kuralların son savunma hattı
--    (User_admin_sube_kurali geleneği):
--    - her kullanıcının en az bir rolü olmalı,
--    - ADMIN (Kurum Yöneticisi) şubesizdir ve başka rolle birleşemez,
--    - STAJYER kendi paneline kilitli olduğundan başka rolle birleşemez,
--    - ADMIN dışındaki herkes bir şubeye bağlıdır.
ALTER TABLE "User" ADD CONSTRAINT "User_rol_dolu"
  CHECK (cardinality("roles") > 0);
ALTER TABLE "User" ADD CONSTRAINT "User_yonetici_sube_kurali"
  CHECK (('ADMIN' = ANY("roles") AND "branchId" IS NULL)
      OR (NOT ('ADMIN' = ANY("roles")) AND "branchId" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT "User_admin_tek_rol"
  CHECK (NOT ('ADMIN' = ANY("roles")) OR "roles" = ARRAY['ADMIN']::"Role"[]);
ALTER TABLE "User" ADD CONSTRAINT "User_stajyer_tek_rol"
  CHECK (NOT ('STAJYER' = ANY("roles")) OR "roles" = ARRAY['STAJYER']::"Role"[]);

-- 6. Dizi süzgeçleri (`roles @> ARRAY[...]`) için GIN indeks.
CREATE INDEX "User_roles_idx" ON "User" USING GIN ("roles");
