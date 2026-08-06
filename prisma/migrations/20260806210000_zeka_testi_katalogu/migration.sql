-- Zeka testi kataloğu.
--
-- Yükleme formundaki "Testin adı" serbest metin yerine açılır listeden
-- seçiliyor; liste bu tablodan geliyor. Şubeden bağımsız (atölye kataloğu
-- gibi). Yönetim ekranı yok, kurum listeyi şimdilik veritabanından
-- güncelliyor. IntelligenceTest.testName metin olarak kalıyor (snapshot):
-- katalog değişse de geçmiş kayıtlar bozulmaz.
CREATE TABLE "IntelligenceTestType" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntelligenceTestType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntelligenceTestType_name_key" ON "IntelligenceTestType"("name");
CREATE INDEX "IntelligenceTestType_active_sortOrder_idx"
  ON "IntelligenceTestType"("active", "sortOrder");

-- Başlangıç listesi — Türkiye'de yaygın uygulanan testlerden örnekler.
-- Kimlikler okunabilir ve sabit (ilk_yonetici migration'ındaki desen);
-- kurum adları/sırayı değiştirebilir, yenilerini ekleyebilir.
INSERT INTO "IntelligenceTestType" ("id", "name", "sortOrder") VALUES
  ('ztk_wisc_4',       'WISC-4 (WÇZÖ-IV)',                 10),
  ('ztk_wisc_r',       'WISC-R',                            20),
  ('ztk_stanford',     'Stanford-Binet',                    30),
  ('ztk_cas',          'CAS (Bilişsel Değerlendirme)',      40),
  ('ztk_agte',         'AGTE (Ankara Gelişim Tarama)',      50),
  ('ztk_denver',       'Denver II Gelişim Tarama',          60),
  ('ztk_metropolitan', 'Metropolitan Okul Olgunluğu',       70),
  ('ztk_frostig',      'Frostig Görsel Algı',               80);
