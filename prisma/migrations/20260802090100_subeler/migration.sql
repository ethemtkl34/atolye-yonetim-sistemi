-- Çok şubeli yapı: Branch tablosu ve şube sınırının durduğu üç kolon.
--
-- Şube sınırı yalnızca User, Group ve Student'ta doğrudan durur; kayıt,
-- oturum, puanlama ve raporun şubesi ilişkiden türetilir. Dönem, kulüp,
-- atölye çeşidi ve sorular ORTAKTIR (kurum aynı programı iki konumda
-- uyguluyor), bu yüzden onlara kolon eklenmiyor.
--
-- Yol: nullable kolon → backfill → NOT NULL. Böylece migration, verisi
-- temizlenmemiş bir veritabanında da (yerel, preview, henüz silinmemiş
-- üretim) çalışır. Veri temizliği bilerek burada DEĞİL: migration'lar her
-- ortamda otomatik çalışır, yıkıcı bir migration bir preview dalı uzaklıkta
-- felakettir. Temizlik `prisma/temizlik.ts` ile elle yapılır.

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");
CREATE INDEX "Branch_active_sortOrder_idx" ON "Branch"("active", "sortOrder");

-- İki şube. Kimlikler bilerek sabit ve ASCII: aşağıdaki backfill ile
-- seed.ts'in tutunabilmesi için yerel, preview ve üretimde aynı olmalılar.
INSERT INTO "Branch" ("id", "code", "name", "sortOrder", "active", "createdAt", "updatedAt") VALUES
  ('sube_umraniye', 'umraniye', 'Ümraniye Tüzder', 0, true, NOW(), NOW()),
  ('sube_gunesli',  'gunesli',  'Güneşli Tüzder',  1, true, NOW(), NOW());

-- AlterTable: önce nullable
ALTER TABLE "User" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Student" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Group" ADD COLUMN "branchId" TEXT;

-- Backfill: mevcut bütün veri ilk şubeye ait sayılır. ADMIN hesabı henüz
-- yok; olsaydı bile şubesiz kalmalı.
UPDATE "Student" SET "branchId" = 'sube_umraniye' WHERE "branchId" IS NULL;
UPDATE "Group"   SET "branchId" = 'sube_umraniye' WHERE "branchId" IS NULL;
UPDATE "User"    SET "branchId" = 'sube_umraniye' WHERE "branchId" IS NULL AND "role" <> 'ADMIN';

-- Artık zorunlu
ALTER TABLE "Student" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "branchId" SET NOT NULL;

-- AddForeignKey: şube silinemez (Restrict) — geçmiş veri yok olmasın.
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- İndeksler: her öğrenci/grup/stajyer sorgusu artık şubeye bağlı.
DROP INDEX "Student_searchName_idx";
DROP INDEX "Student_lastName_firstName_idx";
DROP INDEX "Group_termId_idx";
DROP INDEX "Group_clubId_idx";

CREATE INDEX "Student_branchId_searchName_idx" ON "Student"("branchId", "searchName");
CREATE INDEX "Student_branchId_lastName_firstName_idx" ON "Student"("branchId", "lastName", "firstName");
CREATE INDEX "Group_termId_branchId_idx" ON "Group"("termId", "branchId");
CREATE INDEX "Group_clubId_branchId_idx" ON "Group"("clubId", "branchId");
CREATE INDEX "Group_branchId_active_idx" ON "Group"("branchId", "active");
CREATE INDEX "User_branchId_role_active_idx" ON "User"("branchId", "role", "active");

-- ---------------------------------------------------------------------------
-- Elle eklenen CHECK kısıtı
--
-- Prisma şeması "rol ADMIN ise şube boş, değilse dolu" kuralını ifade
-- edemiyor. Uygulama katmanı da doğruluyor; bu son savunma hattı.
-- Önceki migration'da eklenen 'ADMIN' değeri ancak ayrı bir transaction'da
-- kullanılabildiği için burada duruyor.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD CONSTRAINT "User_admin_sube_kurali"
  CHECK (("role" = 'ADMIN' AND "branchId" IS NULL)
      OR ("role" <> 'ADMIN' AND "branchId" IS NOT NULL));
