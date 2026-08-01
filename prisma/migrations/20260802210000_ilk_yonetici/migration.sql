-- İlk yönetici hesabını açar.
--
-- NEDEN MIGRATION: `20260802090000_rol_admin` enum'a ADMIN'i ekledi ama
-- kimseyi yönetici yapmadı — migration'lar şema taşır, hesap açmaz. Sonuç
-- olarak üretimde ADMIN rolü tanımlı ama tek bir yönetici yok: şube seçici
-- kimseye görünmüyor ve Kullanıcılar ekranına girilemiyor. Yani sistem
-- kendini açamaz durumda (bootstrap sorunu).
--
-- Üretim `DATABASE_URL`'i Vercel'de şifreli tutulduğu için tek seferlik bir
-- script elle çalıştırılamıyor; deploy zincirindeki `prisma migrate deploy`
-- ise o bağlantıyı kullanabilen tek yer. Bu yüzden bootstrap buraya yazıldı.
--
-- GÜVENLİ: yıkıcı değil, bir hesabın rolünü yükseltiyor ve tersi tek UPDATE
-- ile alınabiliyor. Üç koşulla dar tutuldu:
--   1. Yalnızca `admin` kullanıcı adlı hesap,
--   2. yalnızca o hesap zaten yönetici DEĞİLSE,
--   3. yalnızca sistemde HİÇ yönetici yoksa.
-- Üçüncü koşul bunu gerçek bir "ilk kurulum" adımı yapıyor: kurum sonradan
-- kendi yöneticilerini açtıysa ve bu hesabı bilerek düşürdüyse, migration
-- geçmişi yeni bir ortamda yeniden oynatıldığında o kararı geri almaz.
--
-- Rol ve şube TEK ifadede değişmek zorunda: `User_admin_sube_kurali` CHECK'i
-- "yönetici şubesiz, diğerleri şubeli" diyor; ikisi ayrı UPDATE olsaydı
-- aradaki satır kısıta takılırdı.
UPDATE "User"
   SET "role" = 'ADMIN',
       "branchId" = NULL
 WHERE "email" = 'admin'
   AND "role" <> 'ADMIN'
   AND NOT EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN');
