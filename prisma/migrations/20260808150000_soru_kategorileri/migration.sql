-- Soru kategorileri ve gerçek değerlendirme soruları.
--
-- Kurumun kullandığı gerçek karne soruları (C-1 Yaz Grubu 2025-2026 Excel'i)
-- sisteme aktarılıyor. İki yenilik:
--
--   1. Soruların artık bir konu başlığı (category — "Dersin İlgi ve Merak
--      Alanları" / "Dersin Yetenek Gelişim Alanları") ve çoğunda kısa bir
--      başlığı (title — örn. "Duygu Düzenleme") var. Rapor düzyazısı soru
--      cümlesi ("... gösteriyor mu?") yerine kısa başlığı kullanır.
--   2. Excel'deki 11 atölyenin soru setleri mevcut soruların yerine geçer.
--      soruSil eylemindeki kural toplu uygulanır: cevabı olan eski soru
--      pasife alınır (geçmiş formlar snapshot'larıyla görünmeye devam eder),
--      cevabı olmayan silinir.
--
-- Expand aşaması: eski kod yeni sütunları görmez, deploy sırasında eski
-- sürüm sorunsuz çalışmaya devam eder. Her adım tekrar çalıştırmaya
-- dayanıklıdır (ON CONFLICT / sabit id önekleri).

-- 1) Şema genişletme --------------------------------------------------------

ALTER TABLE "Question"
  ADD COLUMN "title"    TEXT,
  ADD COLUMN "category" TEXT;

-- questionTextSnapshot ilkesinin başlık/kategori eşleri: puanlama anındaki
-- değerler cevapla birlikte donar, soru sonradan değişse de rapor bozulmaz.
ALTER TABLE "ScoreAnswer"
  ADD COLUMN "titleSnapshot"    TEXT,
  ADD COLUMN "categorySnapshot" TEXT;

-- 2) Atölye eşleştirme tablosu ----------------------------------------------
--
-- Excel sayfası → sistemdeki atölye. Adlar koordinatör tarafından
-- değiştirilebildiği için birebir ad yerine desenle eşleşiyoruz. Desenler
-- noktalı/noktasız i sorunundan kaçınmak için adın küçük harfli gövdesinden
-- seçildi (ILIKE'ın Türkçe büyük harf katlaması sunucu locale'ine bağlı;
-- küçük harfli gövde her yerde birebir eşleşir).

CREATE TEMP TABLE _eslesme (
  kod   TEXT PRIMARY KEY,
  sira  INT,
  ad    TEXT,   -- eşleşme yoksa bu adla oluşturulur
  desen TEXT,
  haric TEXT    -- desenin yanlış yakalayacağı adları dışlar
);

INSERT INTO _eslesme (kod, sira, ad, desen, haric) VALUES
  ('bilim',      1,  'Bilim Atölyesi',                             '%ilim%',     NULL),
  ('duygusal',   2,  'Sosyal Duygusal Beceriler Atölyesi (Drama)', '%uygusal%',  NULL),
  ('robotik',    3,  'Robotik ve Kodlama Atölyesi',                '%obotik%',   NULL),
  ('astronomi',  4,  'Astronomi Atölyesi',                         '%stronomi%', '%gastr%'),
  ('stem',       5,  'STEM Maker Atölyesi',                        '%stem%',     NULL),
  ('masal',      6,  'Masal ve Hikâye Atölyesi',                   '%asal%',     NULL),
  ('dusunme',    7,  'Düşünme Becerileri Atölyesi',                '%üşünme%',   NULL),
  ('gastronomi', 8,  'Gastronomi Atölyesi',                        '%gastr%',    NULL),
  ('ahsap',      9,  'Ahşap Modelleme Atölyesi',                   '%odelleme%', NULL),
  ('hayal',      10, 'Hayal Tasarım Atölyesi',                     '%ayal%',     NULL),
  ('zeka',       11, 'Zekâ ve Akıl Oyunları Atölyesi',             '%oyun%',     NULL);

-- 3) Sistemde karşılığı olmayan atölyeleri oluştur --------------------------
--
-- Kimlikler okunabilir ve sabit (ilk_yonetici desenindeki gibi); sortOrder
-- mevcut listenin sonuna eklenir.

INSERT INTO "WorkshopType" ("id", "name", "description", "active", "sortOrder", "createdAt", "updatedAt")
SELECT
  'atl_' || e.kod,
  e.ad,
  NULL,
  true,
  (SELECT COALESCE(MAX("sortOrder"), 0) FROM "WorkshopType") + e.sira,
  now(),
  now()
FROM _eslesme e
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkshopType" w
  WHERE w."name" ILIKE e.desen
    AND (e.haric IS NULL OR w."name" NOT ILIKE e.haric)
)
ON CONFLICT ("id") DO NOTHING;

-- 4) Hedef atölye kimliklerini çöz ------------------------------------------
--
-- Aynı desene birden fazla atölye uyarsa en eskisi (kurumun asıl kaydı)
-- seçilir; sonradan açılmış kopyalar elle pasife alınabilir.

CREATE TEMP TABLE _hedef AS
SELECT
  e.kod,
  (SELECT w."id" FROM "WorkshopType" w
   WHERE w."name" ILIKE e.desen
     AND (e.haric IS NULL OR w."name" NOT ILIKE e.haric)
   ORDER BY w."createdAt" ASC
   LIMIT 1) AS wid
FROM _eslesme e;

-- 5) Eski soruları devreden çıkar -------------------------------------------
--
-- soruSil kuralının toplu hâli. Yeni sorular 'soru_' önekli sabit id taşır;
-- önek koşulu migration'ın yarıda kalıp tekrar çalışması hâlinde yeni
-- soruların kendi kendini silmesini önler.

UPDATE "Question" q
SET "active" = false, "updatedAt" = now()
FROM _hedef h
WHERE q."workshopTypeId" = h.wid
  AND q."active"
  AND q."id" NOT LIKE 'soru\_%'
  AND EXISTS (SELECT 1 FROM "ScoreAnswer" sa WHERE sa."questionId" = q."id");

DELETE FROM "Question" q
USING _hedef h
WHERE q."workshopTypeId" = h.wid
  AND q."id" NOT LIKE 'soru\_%'
  AND NOT EXISTS (SELECT 1 FROM "ScoreAnswer" sa WHERE sa."questionId" = q."id");

-- 6) Yeni sorular ------------------------------------------------------------
--
-- Excel'den birebir; yalnızca bariz yazım hataları düzeltildi
-- ("Pleneteryum" → "Planetaryum"). Sıra 0-3 ilgi, 4-9 yetenek bloğu.
-- Dört atölyede (STEM Maker, Masal, Gastronomi, Ahşap) sorular tek parçalı:
-- başlık yok (NULL), yalnızca metin.

CREATE TEMP TABLE _sorular (
  kod      TEXT,
  sira     INT,
  kategori TEXT,
  baslik   TEXT,
  metin    TEXT
);

INSERT INTO _sorular (kod, sira, kategori, baslik, metin) VALUES
  -- Bilim Atölyesi
  ('bilim', 0, 'Dersin İlgi ve Merak Alanları', 'Yeni Bilgilere Açıklık', 'Çocuk, bilimle ilgili yeni bilgiler ve keşifler öğrenmeye istekli mi?'),
  ('bilim', 1, 'Dersin İlgi ve Merak Alanları', 'Soru Sorma ve Araştırma İsteği', 'Derste aktif olarak soru soruyor ve merak ettiklerini araştırmaya yöneliyor mu?'),
  ('bilim', 2, 'Dersin İlgi ve Merak Alanları', 'Deneylere ve Aktivitelere Katılım', 'Uygulamalı deneyler ve aktivitelerde aktif bir şekilde yer alıyor mu?'),
  ('bilim', 3, 'Dersin İlgi ve Merak Alanları', 'Bilimsel Süreçlere İlgi', 'Bilimsel süreçlere (gözlem, hipotez kurma, deneme-yanılma) karşı meraklı mı?'),
  ('bilim', 4, 'Dersin Yetenek Gelişim Alanları', 'Bilimsel Düşünme Becerisi', 'Çocuk, olaylar ve deneyler arasında neden-sonuç ilişkisi kurabiliyor mu?'),
  ('bilim', 5, 'Dersin Yetenek Gelişim Alanları', 'Problem Çözme ve Deneme Becerisi', 'Bilimsel deneylerde karşılaştığı sorunları çözmek için yaratıcı yollar deniyor mu?'),
  ('bilim', 6, 'Dersin Yetenek Gelişim Alanları', 'Kavramları Anlama', 'Bilimsel kavramları ve terimleri ne kadar iyi anlayabiliyor ve kullanabiliyor?'),
  ('bilim', 7, 'Dersin Yetenek Gelişim Alanları', 'Takım Çalışması ve İş Birliği', 'Grup içinde bilimsel projeler yaparken iş birliği ve iletişim kurma becerisi nasıl?'),
  ('bilim', 8, 'Dersin Yetenek Gelişim Alanları', 'Gözlem ve Analiz Yeteneği', 'Bilimsel deneylerde gözlem yapma ve sonuçları analiz etme becerisi nasıl gelişmiş?'),
  ('bilim', 9, 'Dersin Yetenek Gelişim Alanları', 'Bilimsel Yöntemi Kullanma', 'Bilimsel yöntemleri (hipotez kurma, test etme, sonuç çıkarma) nasıl kullanabiliyor?'),

  -- Sosyal Duygusal Beceriler Atölyesi (Drama) — "Duygusal Sosyal" sayfası
  ('duygusal', 0, 'Dersin İlgi ve Merak Alanları', 'Başkalarını Anlama ve Dinleme İsteği', 'Çocuk, diğer insanların duygularını anlamak ve dinlemek konusunda meraklı mı?'),
  ('duygusal', 1, 'Dersin İlgi ve Merak Alanları', 'Kendini İfade Etme İsteği', 'Çocuk, duygularını ve düşüncelerini açıkça ifade etme konusunda istekli mi?'),
  ('duygusal', 2, 'Dersin İlgi ve Merak Alanları', 'Sosyal Etkileşimlere Katılma', 'Sosyal etkinliklere, grup çalışmalarına ve tartışmalara aktif olarak katılıyor mu?'),
  ('duygusal', 3, 'Dersin İlgi ve Merak Alanları', 'Empati Geliştirmeye Yönelik İlgi', 'Başkalarının bakış açılarını anlamaya ve empati geliştirmeye yönelik ilgi gösteriyor mu?'),
  ('duygusal', 4, 'Dersin Yetenek Gelişim Alanları', 'Duygusal Farkındalık', 'Çocuk, kendi duygularını ve başkalarının duygularını tanıyabiliyor mu?'),
  ('duygusal', 5, 'Dersin Yetenek Gelişim Alanları', 'İletişim ve İfade Becerisi', 'Duygularını ve düşüncelerini etkili ve açık bir şekilde ifade edebiliyor mu?'),
  ('duygusal', 6, 'Dersin Yetenek Gelişim Alanları', 'Empati Kurma Yeteneği', 'Başkalarının duygularını ve ihtiyaçlarını anlayarak empati yapabiliyor mu?'),
  ('duygusal', 7, 'Dersin Yetenek Gelişim Alanları', 'Grup Çalışmasına Katılım', 'Grup içinde iş birliği yapabiliyor ve başkalarıyla sağlıklı ilişkiler kurabiliyor mu?'),
  ('duygusal', 8, 'Dersin Yetenek Gelişim Alanları', 'Zor Durumlarla Baş Etme Becerisi', 'Sosyal veya duygusal olarak zorlayıcı durumlarla başa çıkma ve uyum sağlama becerisi nasıl?'),
  ('duygusal', 9, 'Dersin Yetenek Gelişim Alanları', 'Sorumluluk Alma ve Yardımlaşma', 'Grup içinde sorumluluk alabiliyor ve başkalarına yardım etme isteği gösteriyor mu?'),

  -- Robotik ve Kodlama Atölyesi
  ('robotik', 0, 'Dersin İlgi ve Merak Alanları', 'Yeni Teknolojilere Karşı İlgi', 'Çocuk, robotik ve teknolojiye karşı genel bir merak ve öğrenme isteği gösteriyor mu?'),
  ('robotik', 1, 'Dersin İlgi ve Merak Alanları', 'Soru Sorma ve Keşfetme İsteği', 'Robotlar ve mekanizmalar hakkında sorular soruyor ve nasıl çalıştığını keşfetmeye çalışıyor mu?'),
  ('robotik', 2, 'Dersin İlgi ve Merak Alanları', 'Proje ve Görevlere Katılım', 'Robotik projelere ve görevlere aktif olarak katılıyor mu?'),
  ('robotik', 3, 'Dersin İlgi ve Merak Alanları', 'Robotik Problemlerle İlgilenme', 'Karşılaştığı robotik sorunları çözmeye yönelik merak ve ilgi gösteriyor mu?'),
  ('robotik', 4, 'Dersin Yetenek Gelişim Alanları', 'Algoritmik Düşünme Becerisi', 'Çocuk, adım adım düşünerek sorunları çözebiliyor ve görevleri tamamlayabiliyor mu?'),
  ('robotik', 5, 'Dersin Yetenek Gelişim Alanları', 'Kodlama ve Programlama Yeteneği', 'Temel seviyede robotik kodlama yapabiliyor ve komutları uygulayabiliyor mu?'),
  ('robotik', 6, 'Dersin Yetenek Gelişim Alanları', 'Mekanik ve Tasarım Becerisi', 'Robot parçalarını doğru bir şekilde birleştirme ve tasarlama becerisi gösteriyor mu?'),
  ('robotik', 7, 'Dersin Yetenek Gelişim Alanları', 'Problem Çözme ve Teknik Sorunlara Müdahale', 'Robotların teknik problemlerini tespit edip çözüm üretebiliyor mu?'),
  ('robotik', 8, 'Dersin Yetenek Gelişim Alanları', 'Takım Çalışması ve İş Birliği', 'Diğer çocuklarla iş birliği yaparak robotik projeleri tamamlayabiliyor mu?'),
  ('robotik', 9, 'Dersin Yetenek Gelişim Alanları', 'Üreticilik ve Yenilikçilik', 'Kendi robot tasarımlarını oluşturma ve üretici fikirlerle projelere katkıda bulunma yeteneği nasıl?'),

  -- Astronomi Atölyesi
  ('astronomi', 0, 'Dersin İlgi ve Merak Alanları', 'Evren ve Gezegenlere İlgi', 'Çocuk, evren, gezegenler, yıldızlar ve diğer gök cisimlerine karşı merak ve ilgi gösteriyor mu?'),
  ('astronomi', 1, 'Dersin İlgi ve Merak Alanları', 'Soru Sorma ve Araştırma İsteği', 'Astronomiyle ilgili sorular soruyor ve konuları daha derinlemesine araştırmak istiyor mu?'),
  ('astronomi', 2, 'Dersin İlgi ve Merak Alanları', 'Planetaryum Gözlemlerine İlgi', 'Planetaryum gözlemlerine ve astronomi konularına aktif olarak katılıyor mu?'),
  ('astronomi', 3, 'Dersin İlgi ve Merak Alanları', 'Yeni Kavramları Öğrenmeye İstekli Olma', 'Astronomiyle ilgili yeni kavramları (yıldızlar, gezegenler, galaksiler vb.) öğrenmeye istekli mi?'),
  ('astronomi', 4, 'Dersin Yetenek Gelişim Alanları', 'Temel Astronomi Bilgisi', 'Çocuk, gezegenler, yıldızlar ve galaksiler gibi temel astronomi konularını anlama ve hatırlama yeteneği gösteriyor mu?'),
  ('astronomi', 5, 'Dersin Yetenek Gelişim Alanları', 'Gözlem Becerileri', 'Çocuk, planetaryumda gözlem yaparken dikkatli bir şekilde inceleyip gözlemlerini yapabiliyor mu?'),
  ('astronomi', 6, 'Dersin Yetenek Gelişim Alanları', 'Problem Çözme ve Hipotez Kurma', 'Astronomiyle ilgili problemler karşısında çözüm üretme ve hipotez kurma yeteneği nasıl?'),
  ('astronomi', 7, 'Dersin Yetenek Gelişim Alanları', 'Bilimsel Süreçleri Kullanma', 'Çocuk, bilimsel yöntemlerle gözlemlerini analiz etme ve sonuçlar çıkarma becerisi sergileyebiliyor mu?'),
  ('astronomi', 8, 'Dersin Yetenek Gelişim Alanları', 'Astronomik Araçlara İlgi', 'Teleskop, harita gibi astronomik araçlara ilgisi nasıl?'),
  ('astronomi', 9, 'Dersin Yetenek Gelişim Alanları', 'Takım Çalışması ve İş Birliği', 'Grup içi astronomi projelerine katılım sağlayabiliyor ve iş birliği yapabiliyor mu?'),

  -- STEM Maker Atölyesi (tek parçalı sorular)
  ('stem', 0, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere ilgi gösterme'),
  ('stem', 1, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere katılım sağlama ve etkileşim kurma'),
  ('stem', 2, 'Dersin İlgi ve Merak Alanları', NULL, 'Yeni şeyler öğrenmeye dair merak ve keşif'),
  ('stem', 3, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye etkinlik esnasında sorulan sorulara cevap verme'),
  ('stem', 4, 'Dersin Yetenek Gelişim Alanları', NULL, 'Elektronik devre kavramını bilir.'),
  ('stem', 5, 'Dersin Yetenek Gelişim Alanları', NULL, 'Elektronik devre elemanlarını tanır.'),
  ('stem', 6, 'Dersin Yetenek Gelişim Alanları', NULL, 'Kendi elektronik devresini kurar.'),
  ('stem', 7, 'Dersin Yetenek Gelişim Alanları', NULL, 'Elektrikte +/- yön kavramını bilir.'),
  ('stem', 8, 'Dersin Yetenek Gelişim Alanları', NULL, 'Seri devre ve paralel devre farklarını bilir.'),
  ('stem', 9, 'Dersin Yetenek Gelişim Alanları', NULL, 'Günlük hayatta karşılaştığı elektronik malzemelerin nasıl çalıştıklarını açıklar.'),

  -- Masal ve Hikâye Atölyesi (tek parçalı sorular)
  ('masal', 0, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere ilgi gösterme'),
  ('masal', 1, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere katılım sağlama ve etkileşim kurma'),
  ('masal', 2, 'Dersin İlgi ve Merak Alanları', NULL, 'Yeni şeyler öğrenmeye dair merak ve keşif'),
  ('masal', 3, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye etkinlik esnasında sorulan sorulara cevap verme'),
  ('masal', 4, 'Dersin Yetenek Gelişim Alanları', NULL, 'El, zihin ve göz koordinasyonu gelişir; neden-sonuç ilişkisi kurabilir.'),
  ('masal', 5, 'Dersin Yetenek Gelişim Alanları', NULL, '3 boyutlu düşünüp tasarlayabilir.'),
  ('masal', 6, 'Dersin Yetenek Gelişim Alanları', NULL, 'Hayal dünyasını özgün bir şekilde ifade eder / yansıtır.'),
  ('masal', 7, 'Dersin Yetenek Gelişim Alanları', NULL, 'Oran-orantı, sınıflandırma ve büyük-küçük ilişkisi kurabilir.'),
  ('masal', 8, 'Dersin Yetenek Gelişim Alanları', NULL, 'Somut-soyut ilişkisi kurabilir.'),
  ('masal', 9, 'Dersin Yetenek Gelişim Alanları', NULL, 'Zamanı doğru kullanabilir.'),

  -- Düşünme Becerileri Atölyesi
  ('dusunme', 0, 'Dersin İlgi ve Merak Alanları', 'Sorular Sorma ve Keşfetme İsteği', 'Çocuk, çeşitli düşünme becerileri hakkında soru soruyor ve yeni şeyler keşfetmeye istekli mi?'),
  ('dusunme', 1, 'Dersin İlgi ve Merak Alanları', 'Problemlere İlgi Gösterme', 'Zihinsel veya mantıksal problemleri çözmeye çalışırken merak ve ilgi gösteriyor mu?'),
  ('dusunme', 2, 'Dersin İlgi ve Merak Alanları', 'Aktif Katılım', 'Fikir yürütme, tartışma ve problem çözme aktivitelerine aktif olarak katılıyor mu?'),
  ('dusunme', 3, 'Dersin İlgi ve Merak Alanları', 'Yeni Bilgiye Açıklık', 'Farklı bakış açılarını anlamaya, yeni düşünme stratejileri öğrenmeye karşı istekli mi?'),
  ('dusunme', 4, 'Dersin Yetenek Gelişim Alanları', 'Kritik Düşünme Becerisi', 'Çocuk, olaylar ve problemler hakkında derinlemesine düşünüp analiz yapabiliyor mu?'),
  ('dusunme', 5, 'Dersin Yetenek Gelişim Alanları', 'Mantıksal Akıl Yürütme', 'Nedensel ilişkilere dayalı mantıklı çıkarımlar yapabiliyor mu?'),
  ('dusunme', 6, 'Dersin Yetenek Gelişim Alanları', 'Üretici Düşünme Becerisi', 'Farklı veya sıra dışı çözümler bulma, yenilikçi düşünme yeteneği ne durumda?'),
  ('dusunme', 7, 'Dersin Yetenek Gelişim Alanları', 'Esnek Düşünme', 'Sorunlara farklı perspektiflerden bakabiliyor ve yeni çözümler üretebiliyor mu?'),
  ('dusunme', 8, 'Dersin Yetenek Gelişim Alanları', 'Karar Verme Becerisi', 'Bilgiye dayalı, mantıklı ve etkili kararlar alabiliyor mu?'),
  ('dusunme', 9, 'Dersin Yetenek Gelişim Alanları', 'Analiz ve Değerlendirme', 'Çocuk, olayları veya bilgileri analiz edip objektif bir şekilde değerlendirme yapabiliyor mu?'),

  -- Gastronomi Atölyesi (tek parçalı sorular)
  ('gastronomi', 0, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere ilgi gösterme'),
  ('gastronomi', 1, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere katılım sağlama ve etkileşim kurma'),
  ('gastronomi', 2, 'Dersin İlgi ve Merak Alanları', NULL, 'Yeni şeyler öğrenmeye dair merak ve keşif'),
  ('gastronomi', 3, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye etkinlik esnasında sorulan sorulara cevap verme'),
  ('gastronomi', 4, 'Dersin Yetenek Gelişim Alanları', NULL, 'Mutfak hakkında genel bilgi edinme'),
  ('gastronomi', 5, 'Dersin Yetenek Gelişim Alanları', NULL, 'Mutfak gereçlerini tanıma ve kullanma'),
  ('gastronomi', 6, 'Dersin Yetenek Gelişim Alanları', NULL, 'Verilen tarifleri uygulama ve alternatif tarif üretme'),
  ('gastronomi', 7, 'Dersin Yetenek Gelişim Alanları', NULL, 'Kullanılan malzemelerin özelliklerini öğrenme'),
  ('gastronomi', 8, 'Dersin Yetenek Gelişim Alanları', NULL, 'Reçete ve aşamalara uyma gereğinin önemini anlama'),
  ('gastronomi', 9, 'Dersin Yetenek Gelişim Alanları', NULL, 'Hijyen kurallarına uyma gerekliliğini kavrama'),

  -- Ahşap Modelleme Atölyesi (tek parçalı sorular)
  ('ahsap', 0, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere ilgi gösterme'),
  ('ahsap', 1, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye ve etkinliklere katılım sağlama ve etkileşim kurma'),
  ('ahsap', 2, 'Dersin İlgi ve Merak Alanları', NULL, 'Yeni şeyler öğrenmeye dair merak ve keşif'),
  ('ahsap', 3, 'Dersin İlgi ve Merak Alanları', NULL, 'Atölye etkinlik esnasında sorulan sorulara cevap verme'),
  ('ahsap', 4, 'Dersin Yetenek Gelişim Alanları', NULL, '3 boyutlu düşünüp tasarlar.'),
  ('ahsap', 5, 'Dersin Yetenek Gelişim Alanları', NULL, 'Hayal dünyasını yansıtabilir.'),
  ('ahsap', 6, 'Dersin Yetenek Gelişim Alanları', NULL, 'Çalışmasına istikrarla devam edip tamamlar.'),
  ('ahsap', 7, 'Dersin Yetenek Gelişim Alanları', NULL, 'Zamanı doğru ve etkin kullanır.'),
  ('ahsap', 8, 'Dersin Yetenek Gelişim Alanları', NULL, 'Problem ve sorunlara çözüm üretir.'),
  ('ahsap', 9, 'Dersin Yetenek Gelişim Alanları', NULL, 'Özgün ve kreatif tasarımlar oluşturur.'),

  -- Hayal Tasarım Atölyesi
  ('hayal', 0, 'Dersin İlgi ve Merak Alanları', 'Üretici Fikirlere Açıklık', 'Çocuk, yeni ve yaratıcı fikirler üretme konusunda istekli ve hevesli mi?'),
  ('hayal', 1, 'Dersin İlgi ve Merak Alanları', 'Hayal Gücünü Kullanma İsteği', 'Çocuk, hayal gücünü kullanarak projelere özgün katkılarda bulunmaya ilgi gösteriyor mu?'),
  ('hayal', 2, 'Dersin İlgi ve Merak Alanları', 'Aktif Katılım ve Araştırma İsteği', 'Projeler ve görevlerde aktif olarak yer alıyor ve tasarım süreçlerini keşfetmek istiyor mu?'),
  ('hayal', 3, 'Dersin İlgi ve Merak Alanları', 'Soru Sorma ve Fikir Geliştirme İsteği', 'Tasarım süreçleriyle ilgili sorular soruyor ve fikirlerini geliştirmeye çalışıyor mu?'),
  ('hayal', 4, 'Dersin Yetenek Gelişim Alanları', 'Üreticilik ve İnovasyon', 'Çocuk, özgün fikirler üretebiliyor ve yenilikçi tasarımlar ortaya koyabiliyor mu?'),
  ('hayal', 5, 'Dersin Yetenek Gelişim Alanları', 'Problem Çözme Becerisi', 'Hayali bir soruna veya tasarım zorluğuna yönelik yaratıcı çözümler geliştirebiliyor mu?'),
  ('hayal', 6, 'Dersin Yetenek Gelişim Alanları', 'Estetik Anlayış ve Tasarım Becerisi', 'Çocuk, tasarımlarında estetik unsurları dikkate alabiliyor ve uyumlu çalışmalar yapabiliyor mu?'),
  ('hayal', 7, 'Dersin Yetenek Gelişim Alanları', 'Detaylara Dikkat Etme', 'Tasarımlarında detayları fark etme ve inceleme yeteneği nasıl gelişmiş?'),
  ('hayal', 8, 'Dersin Yetenek Gelişim Alanları', 'Hayal ile Gerçek Dünya Arasında Bağlantı Kurma', 'Çocuk, hayal ettiği fikirleri gerçek dünyadaki problemler veya çözümlerle ilişkilendirebiliyor mu?'),
  ('hayal', 9, 'Dersin Yetenek Gelişim Alanları', 'Grup Çalışması ve Paylaşma', 'Tasarım sürecinde başkalarıyla iş birliği yapabiliyor ve fikirlerini paylaşabiliyor mu?'),

  -- Zekâ ve Akıl Oyunları Atölyesi
  ('zeka', 0, 'Dersin İlgi ve Merak Alanları', 'Zeka Oyunlarına İlgi', 'Çocuk, zeka oyunlarına ve problem çözme etkinliklerine karşı merak ve ilgi gösteriyor mu?'),
  ('zeka', 1, 'Dersin İlgi ve Merak Alanları', 'Soru Sorma ve Strateji Geliştirme İsteği', 'Oyunlar ve görevler sırasında aktif olarak soru soruyor ve stratejiler geliştirmeye çalışıyor mu?'),
  ('zeka', 2, 'Dersin İlgi ve Merak Alanları', 'Farklı Çözümler Arama', 'Problemlerle karşılaştığında farklı yollarla çözüm aramaya istekli mi?'),
  ('zeka', 3, 'Dersin İlgi ve Merak Alanları', 'Zorlayıcı Görevlere İlgi', 'Zorlayıcı bulmacalar veya oyunlarla karşılaştığında ilgisini sürdürüyor ve çözüme ulaşmaya çalışıyor mu?'),
  ('zeka', 4, 'Dersin Yetenek Gelişim Alanları', 'Problem Çözme Becerisi', 'Çocuk, karşılaştığı problemlere uygun çözümler bulabiliyor mu?'),
  ('zeka', 5, 'Dersin Yetenek Gelişim Alanları', 'Mantıksal Akıl Yürütme', 'Zeka oyunlarında mantıksal ilişki kurma ve akıl yürütme becerisi nasıl gelişmiş?'),
  ('zeka', 6, 'Dersin Yetenek Gelişim Alanları', 'Dikkat ve Odaklanma Becerisi', 'Oyun ve görevler sırasında dikkatini toplama ve görevde kalma becerisi ne durumda?'),
  ('zeka', 7, 'Dersin Yetenek Gelişim Alanları', 'Stratejik Düşünme', 'Oyunları veya görevleri planlarken uzun vadeli stratejiler geliştirme yeteneği gösteriyor mu?'),
  ('zeka', 8, 'Dersin Yetenek Gelişim Alanları', 'Zihinsel Esneklik', 'Farklı problemlere karşı esnek yaklaşımlar sergileyebiliyor ve gerektiğinde stratejilerini değiştirebiliyor mu?'),
  ('zeka', 9, 'Dersin Yetenek Gelişim Alanları', 'Süreç Takibi ve Organizasyon', 'Çocuk, uzun vadeli görevlerde süreç takibi yapabiliyor ve görevleri organize bir şekilde tamamlayabiliyor mu?');

INSERT INTO "Question" ("id", "workshopTypeId", "text", "title", "category", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'soru_' || s.kod || '_' || lpad(s.sira::text, 2, '0'),
  h.wid,
  s.metin,
  s.baslik,
  s.kategori,
  s.sira,
  true,
  now(),
  now()
FROM _sorular s
JOIN _hedef h ON h.kod = s.kod
WHERE h.wid IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

DROP TABLE _sorular;
DROP TABLE _hedef;
DROP TABLE _eslesme;
