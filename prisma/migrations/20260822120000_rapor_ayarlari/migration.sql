-- §11.2 — Rapor eşikleri, kıyas kuralı ve kademe etiketleri artık panelden
-- yönetiliyor.
--
-- Tek satırlık yapılandırma (id = 'tek'). Satır BURADA OLUŞTURULMUYOR:
-- kod satır yokken kendi varsayılanlarını kullanıyor, böylece migration ile
-- uygulama arasındaki deploy penceresinde de doğru davranıyor. İlk kayıt ayar
-- sayfası ilk kez kaydedildiğinde upsert ile açılır.
--
-- Varsayılanlar `VARSAYILAN_ESIKLER` ile BİREBİR aynı: satır olsa da olmasa
-- da sistem aynı raporu üretmeli. Tek gerçek davranış değişikliği
-- kiyasAsgariOgrenci = 3 — eskiden fiilen 2 idi ve iki kişilik bir grupta
-- "yaşıtlarının üzerinde" hükmü çıkabiliyordu. Yalnızca bundan sonra
-- üretilecek raporlara işler; üretilmişlerin gövdesi donmuş durumda (§13.17).
CREATE TABLE "RaporAyari" (
    "id" TEXT NOT NULL DEFAULT 'tek',
    "atolyeYuksekEsigi" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "atolyeDusukEsigi" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "gelisimFarkEsigi" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "asimetriEsigi" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "kiyasAsgariOgrenci" INTEGER NOT NULL DEFAULT 3,
    "etiketYuksek" TEXT NOT NULL DEFAULT 'Yüksek',
    "etiketOrtalama" TEXT NOT NULL DEFAULT 'Ortalama',
    "etiketDusuk" TEXT NOT NULL DEFAULT 'Düşük',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "RaporAyari_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RaporAyari" ADD CONSTRAINT "RaporAyari_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
