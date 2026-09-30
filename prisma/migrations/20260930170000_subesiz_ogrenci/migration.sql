-- Şubesiz öğrenci ve veli (30 Eylül 2026).
--
-- `Student.branchId` ve `Veli.branchId` ortak havuzla birlikte yalnız
-- "kayıt şubesi" etiketine dönüştü. Eski arşivden aktarılan öğrencilerin
-- hangi şubede test olduğu bilinmiyor; yanlış bir etiket yazmak yerine alan
-- boş bırakılabilir hâle geliyor. Mevcut satırlara dokunulmuyor.
ALTER TABLE "Student" ALTER COLUMN "branchId" DROP NOT NULL;
ALTER TABLE "Veli" ALTER COLUMN "branchId" DROP NOT NULL;
