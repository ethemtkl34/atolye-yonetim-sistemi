-- Veli görüşmesi: kurumun kendi görüşme formu.
--
-- Üç soruluk "mini test" (kodda geçici yer tutucu olarak işaretliydi) yerini
-- kurumun hazırladığı beş bölümlü, yaşa göre uyarlanan forma bıraktı.
-- `answersJson` biçimi DEĞİŞMEDİ (`[{anahtar, soruMetni, deger}]`), yalnızca
-- içeriği artık 9 gözlem alanının puanı ve satırlara `baslik` ekleniyor —
-- bu yüzden mevcut kayıtlar için veri taşıma gerekmiyor: eski üç cevaplı
-- satırlar kendi soru metinleriyle okunmaya devam eder.

-- Bölüm 1/2/4'ün işaretleri ve serbest metinleri. Nullable: 2026 Ağustos
-- öncesi 7 kayıtta form yok, geriye dönük DOLDURULMUYOR — o görüşmelerde bu
-- bölümler gerçekten sorulmamıştı, boş bırakmak uydurmaktan doğru.
ALTER TABLE "ParentMeeting" ADD COLUMN "formJson" JSONB;

-- Yönlendirme kararları (Bölüm 5).
--
-- Kurumun YÜRÜTTÜĞÜ hizmetlerden türer: ilk altı değer "TherapyType" ile
-- birebir aynı, son üçü terapi olmayan yönlendirmeler. Kâğıt formdaki "Filial
-- Terapi" kurumun hizmet listesinde olmadığı için girmedi; "Psiko Rol Drama"
-- ile "Robotik Kodlama" tek bir KULUP değerinde toplandı (hangisi olduğu nota
-- yazılır).
CREATE TYPE "ReferralKind" AS ENUM (
  'OYUN_TERAPISI',
  'ERGEN_TERAPISI',
  'ERGOTERAPI',
  'BILISSEL_MUDAHALE',
  'KISA_AILE_DANISMANLIGI',
  'UZUN_AILE_DANISMANLIGI',
  'ZEKA_TESTI',
  'ATOLYE',
  'KULUP'
);

-- NEDEN AYRI TABLO (formJson'un içinde değil): yönlendirmenin ömrü görüşmeden
-- uzun. Form bunları "öğrenci bir sonraki döneme geldiğinde ekip ne önerilmiş
-- görsün" diye tutuyor; bu soru ancak satırdan sorgulanır.
CREATE TABLE "ParentMeetingReferral" (
  "id"        TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  -- Bilerek denormalize: öğrencinin yönlendirme geçmişi görüşmelere
  -- join'lemeden, tek indeksli sorguyla çıksın.
  "studentId" TEXT NOT NULL,
  "kind"      "ReferralKind" NOT NULL,
  -- Kayıt anındaki tür etiketi (questionTextSnapshot ilkesi): hizmet listesi
  -- değişse de geçmiş kayıt o günkü adı gösterir.
  "label"     TEXT NOT NULL,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentMeetingReferral_pkey" PRIMARY KEY ("id")
);

-- İki Cascade de bilinçli: görüşme silinince kararları da gider (karar
-- görüşmenin parçası), öğrenci silinince tamamı gider (ParentMeeting ile aynı
-- ilke; uygulama katmanı görüşmeli öğrencinin silinmesini zaten engelliyor).
ALTER TABLE "ParentMeetingReferral"
  ADD CONSTRAINT "ParentMeetingReferral_meetingId_fkey" FOREIGN KEY ("meetingId")
    REFERENCES "ParentMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentMeetingReferral"
  ADD CONSTRAINT "ParentMeetingReferral_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aynı görüşmede aynı yönlendirme iki kez işaretlenemez.
CREATE UNIQUE INDEX "ParentMeetingReferral_meetingId_kind_key"
  ON "ParentMeetingReferral"("meetingId", "kind");

-- Öğrencinin yönlendirme geçmişi, en yeniden eskiye.
CREATE INDEX "ParentMeetingReferral_studentId_createdAt_idx"
  ON "ParentMeetingReferral"("studentId", "createdAt");
