-- Soru kategorisi zorunlu hale geliyor ve adlar kurumun kullandığı biçime
-- iniyor: "Dersin İlgi ve Merak Alanları" → "İlgi ve Merak Alanları",
-- "Dersin Yetenek Gelişim Alanları" → "Yetenek Gelişim Alanları".
--
-- categorySnapshot da yeniden adlandırılır. §13.14 soru METNİNİ dondurur;
-- kategori ise rapor kademelerinin (ilgi/başarı) gruplama anahtarı. Eski ad
-- snapshot'ta kalsaydı aynı kategori raporda ikiye bölünür, ortalamalar
-- eksik havuzdan çıkardı. Bu bir içerik değişikliği değil, aynı kategorinin
-- yeniden adlandırılması; updatedAt bilerek dokunulmadan bırakılıyor ki
-- rapor güncelliği (§13.16) bu kozmetik değişiklikle "Güncel değil"e düşmesin.
--
-- Her adım tekrar çalıştırmaya dayanıklıdır.

UPDATE "Question"
SET "category" = 'İlgi ve Merak Alanları'
WHERE "category" = 'Dersin İlgi ve Merak Alanları';

UPDATE "Question"
SET "category" = 'Yetenek Gelişim Alanları'
WHERE "category" = 'Dersin Yetenek Gelişim Alanları';

UPDATE "ScoreAnswer"
SET "categorySnapshot" = 'İlgi ve Merak Alanları'
WHERE "categorySnapshot" = 'Dersin İlgi ve Merak Alanları';

UPDATE "ScoreAnswer"
SET "categorySnapshot" = 'Yetenek Gelişim Alanları'
WHERE "categorySnapshot" = 'Dersin Yetenek Gelişim Alanları';

-- Kategorisiz sorular yalnızca ilk karneden kalan pasif set (50 satır) ve
-- onlar da yeni setle aynı blok düzenindeydi: sıra 0-3 ilgi, 4-9 yetenek.
-- Aynı kuralla doldurulur. (Cevaplardaki NULL categorySnapshot bilerek
-- bırakılıyor: o formlar kategorisiz dönemde dolduruldu ve kategori
-- ortalamalarına hiç girmiyorlardı; geriye dönük dahil etmek geçmiş
-- raporların sayılarını değiştirirdi.)
UPDATE "Question"
SET "category" = CASE
  WHEN "sortOrder" <= 3 THEN 'İlgi ve Merak Alanları'
  ELSE 'Yetenek Gelişim Alanları'
END
WHERE "category" IS NULL;

ALTER TABLE "Question" ALTER COLUMN "category" SET NOT NULL;

-- Liste dışı kategori girilemez. Uygulama Zod ile aynı listeyi zorlar
-- (src/lib/kurallar.ts SORU_KATEGORILERI); yeni kategori eklenecekse iki
-- taraf birlikte güncellenmeli.
ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_category_gecerli";
ALTER TABLE "Question" ADD CONSTRAINT "Question_category_gecerli"
  CHECK ("category" IN ('İlgi ve Merak Alanları', 'Yetenek Gelişim Alanları'));
