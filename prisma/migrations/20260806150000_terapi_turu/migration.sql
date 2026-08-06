-- Terapi türü.
--
-- Öğrenci görüşmeleri artık "Danışmanlık" modülü altında terapi görüşmesi
-- olarak yönetiliyor ve kurum iki tür yürütüyor: oyun terapisi ve danışan
-- terapisi. Görüşmeci türünden (CounselorType) ayrı bir eksen.
CREATE TYPE "TherapyType" AS ENUM ('OYUN_TERAPISI', 'DANISAN_TERAPISI');

-- Mevcut satırlar (varsa) danışan terapisi sayılır — kayıtlar bu ayrımdan
-- önce girildi ve serbest görüşme notu biçimindeydi. DEFAULT geçici: kolon
-- dolduktan sonra kaldırılıyor, tür seçimini uygulama katmanı zorunlu kılar.
ALTER TABLE "CounselingSession"
  ADD COLUMN "therapyType" "TherapyType" NOT NULL DEFAULT 'DANISAN_TERAPISI';
ALTER TABLE "CounselingSession"
  ALTER COLUMN "therapyType" DROP DEFAULT;
