-- §17 — Randevu yönetiminin tanım tabloları: hizmet kataloğu, uzmanlar,
-- yetkinlik, mesai ve izin. Randevunun kendisi ikinci fazda eklenecek.
--
-- İş kuralları uygulama katmanında doğrulanır; buradaki CHECK'ler son savunma
-- hattıdır (Lead ve Enrollment migration'larındaki desen).

CREATE TYPE "HizmetGrubu" AS ENUM ('TEST', 'DANISMANLIK', 'ATOLYE');
CREATE TYPE "DanisanTuru" AS ENUM ('COCUK', 'VELI');
CREATE TYPE "CalismaTipi" AS ENUM ('TAM_ZAMANLI', 'YARI_ZAMANLI');

-- --------------------------------------------------------------------------
-- Hizmet kataloğu
-- --------------------------------------------------------------------------

CREATE TABLE "Hizmet" (
  "id"          TEXT NOT NULL,
  "ad"          TEXT NOT NULL,
  "grup"        "HizmetGrubu" NOT NULL,
  -- Seans süresi dakika cinsinden; bitiş saati bundan türetilip randevuya donar.
  "sureDk"      INTEGER NOT NULL,
  -- Ücret KURUŞ cinsinden. Para `Float` tutulmaz: ondalık değerler ikilik
  -- kayan noktada tam temsil edilmiyor ve ciro toplamı kuruş kaydırıyor.
  "ucretKurus"  INTEGER NOT NULL DEFAULT 0,
  "yasAlt"      INTEGER,
  "yasUst"      INTEGER,
  "danisanTuru" "DanisanTuru" NOT NULL DEFAULT 'COCUK',
  -- Haftalık otomatik tekrar kapsamında mı (danışmanlık evet, test hayır).
  "tekrarli"    BOOLEAN NOT NULL DEFAULT false,
  "aktif"       BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Hizmet_pkey" PRIMARY KEY ("id"),
  -- Bir günü aşan tek seans yok; 0 dakikalık "hizmet" ise izin kaydının
  -- sahte hizmet olarak katalogda durduğu eski CRM alışkanlığıydı — izin
  -- artık kendi tablosunda, katalogda sıfır süre kabul edilmiyor.
  CONSTRAINT "Hizmet_sure_araligi" CHECK ("sureDk" > 0 AND "sureDk" <= 480),
  -- Atölye görüşmesi ücretsiz: sıfır serbest, eksi değil.
  CONSTRAINT "Hizmet_ucret_eksi_olamaz" CHECK ("ucretKurus" >= 0),
  CONSTRAINT "Hizmet_yas_araligi" CHECK (
    "yasAlt" IS NULL OR "yasUst" IS NULL OR "yasAlt" <= "yasUst"
  )
);

CREATE UNIQUE INDEX "Hizmet_ad_key" ON "Hizmet"("ad");
CREATE INDEX "Hizmet_aktif_sortOrder_idx" ON "Hizmet"("aktif", "sortOrder");

-- --------------------------------------------------------------------------
-- Uzman
-- --------------------------------------------------------------------------

CREATE TABLE "Uzman" (
  "id"          TEXT NOT NULL,
  "ad"          TEXT NOT NULL,
  -- Sabit paletten bir anahtar (lib/uzman-renkleri.ts), serbest hex değil.
  "renk"        TEXT NOT NULL,
  "calismaTipi" "CalismaTipi" NOT NULL DEFAULT 'TAM_ZAMANLI',
  -- Panele giren uzmanın hesabı; çoğu uzmanda boş.
  "userId"      TEXT,
  "aktif"       BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Uzman_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Uzman_userId_key" ON "Uzman"("userId");
CREATE INDEX "Uzman_aktif_sortOrder_idx" ON "Uzman"("aktif", "sortOrder");

ALTER TABLE "Uzman"
  ADD CONSTRAINT "Uzman_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Uzmanın şubeleri, yetkinlikleri, mesaisi
-- --------------------------------------------------------------------------

CREATE TABLE "UzmanSube" (
  "uzmanId" TEXT NOT NULL,
  "subeId"  TEXT NOT NULL,

  CONSTRAINT "UzmanSube_pkey" PRIMARY KEY ("uzmanId", "subeId")
);

CREATE INDEX "UzmanSube_subeId_idx" ON "UzmanSube"("subeId");

ALTER TABLE "UzmanSube"
  ADD CONSTRAINT "UzmanSube_uzmanId_fkey"
  FOREIGN KEY ("uzmanId") REFERENCES "Uzman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UzmanSube"
  ADD CONSTRAINT "UzmanSube_subeId_fkey"
  FOREIGN KEY ("subeId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UzmanHizmet" (
  "uzmanId"  TEXT NOT NULL,
  "hizmetId" TEXT NOT NULL,

  CONSTRAINT "UzmanHizmet_pkey" PRIMARY KEY ("uzmanId", "hizmetId")
);

CREATE INDEX "UzmanHizmet_hizmetId_idx" ON "UzmanHizmet"("hizmetId");

ALTER TABLE "UzmanHizmet"
  ADD CONSTRAINT "UzmanHizmet_uzmanId_fkey"
  FOREIGN KEY ("uzmanId") REFERENCES "Uzman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UzmanHizmet"
  ADD CONSTRAINT "UzmanHizmet_hizmetId_fkey"
  FOREIGN KEY ("hizmetId") REFERENCES "Hizmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UzmanMesai" (
  "id"          TEXT NOT NULL,
  "uzmanId"     TEXT NOT NULL,
  "subeId"      TEXT NOT NULL,
  "gun"         "Day" NOT NULL,
  -- Gece yarısından itibaren dakika (540 = 09:00). Tarihsiz bir saati
  -- TIMESTAMP ile taşımak sahte bir güne yaslanmak olurdu.
  "baslangicDk" INTEGER NOT NULL,
  "bitisDk"     INTEGER NOT NULL,

  CONSTRAINT "UzmanMesai_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UzmanMesai_saat_araligi" CHECK (
    "baslangicDk" >= 0 AND "bitisDk" <= 1440 AND "baslangicDk" < "bitisDk"
  )
);

CREATE INDEX "UzmanMesai_uzmanId_gun_idx" ON "UzmanMesai"("uzmanId", "gun");

ALTER TABLE "UzmanMesai"
  ADD CONSTRAINT "UzmanMesai_uzmanId_fkey"
  FOREIGN KEY ("uzmanId") REFERENCES "Uzman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UzmanMesai"
  ADD CONSTRAINT "UzmanMesai_subeId_fkey"
  FOREIGN KEY ("subeId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- İzin
-- --------------------------------------------------------------------------

CREATE TABLE "Izin" (
  "id"              TEXT NOT NULL,
  "uzmanId"         TEXT NOT NULL,
  -- Aralık kapalı-açık: başlangıç dahil, bitiş hariç.
  "baslangic"       TIMESTAMP(3) NOT NULL,
  "bitis"           TIMESTAMP(3) NOT NULL,
  "sebep"           TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Izin_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Izin_aralik_sirali" CHECK ("baslangic" < "bitis")
);

CREATE INDEX "Izin_uzmanId_baslangic_idx" ON "Izin"("uzmanId", "baslangic");

ALTER TABLE "Izin"
  ADD CONSTRAINT "Izin_uzmanId_fkey"
  FOREIGN KEY ("uzmanId") REFERENCES "Uzman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Izin"
  ADD CONSTRAINT "Izin_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
