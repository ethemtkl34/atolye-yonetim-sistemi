-- Aday (CRM) modülünün enum'ları — §16.
--
-- Kurum, potansiyel öğrenci sürecini (web sitesi formu, Meta reklam formu,
-- telefonla arayan, yoldan gelen veli) bugüne kadar dış bir CRM'de (Workiom/
-- Bitrix) yürütüyordu; süreç panele taşınıyor. Bu dosyada YALNIZCA tip
-- tanımları var, tablolar bir sonraki migration'da: mevcut bir enum'a değer
-- eklemek (`ALTER TYPE ... ADD VALUE`) Postgres'te aynı transaction içinde o
-- değerin kullanılmasına izin vermez ve Prisma her migration dosyasını tek
-- transaction'a sarar (bkz. `sube_yoneticisi` migration'ındaki ders). CREATE
-- TYPE için bu kısıt yok ama enum işlerini kendi dosyasında tutmak, ileride
-- değer ekleyecek kişiye kuralı dosya düzeninde görünür kılıyor.

-- Boru hattı aşamaları. KAZANILDI yalnız dönüşüm akışıyla yazılır ve
-- terminaldir; KAYBEDILDI yeniden açılabilir. İzinli geçişlerin tek kaynağı
-- src/lib/aday-durumlari.ts.
CREATE TYPE "LeadStage" AS ENUM (
  'YENI',
  'ULASILDI',
  'RANDEVU_VERILDI',
  'GORUSME_YAPILDI',
  'KAZANILDI',
  'KAYBEDILDI'
);

-- Kaynak. META ve WEB_SITESI yalnız API girişinden yazılır; elle formda
-- seçilemez. "Bu ay Meta'dan kaç aday geldi" sorusu ancak sayılabilir bir
-- alandan cevaplanır.
CREATE TYPE "LeadSource" AS ENUM (
  'META',
  'WEB_SITESI',
  'TELEFON',
  'YOLDAN_GECEN',
  'DIGER'
);

-- Kayıp sebebi — CancelReason ilkesi: etiket, kısa liste, DIGER'de not
-- zorunlu (CHECK bir sonraki migration'da).
CREATE TYPE "LeadLossReason" AS ENUM (
  'ULASILAMADI',
  'FIYAT',
  'UZAKLIK',
  'PROGRAM_UYGUN_DEGIL',
  'VAZGECTI',
  'YANLIS_KAYIT',
  'DIGER'
);

-- Etkinlik türü. ULASILAMADI ayrı: boşa giden deneme sayılabilir olmalı.
-- ASAMA_DEGISIMI ve SISTEM satırlarını yalnızca kod yazar.
CREATE TYPE "LeadActivityType" AS ENUM (
  'ARAMA',
  'ULASILAMADI',
  'WHATSAPP',
  'NOT',
  'ASAMA_DEGISIMI',
  'SISTEM'
);

-- API girişinin sağlık durumu. TAMAM dışındaki her değer panelde yönetici
-- uyarısı üretir; aday hiçbir koşulda düşürülmez.
CREATE TYPE "LeadIngestStatus" AS ENUM (
  'TAMAM',
  'ESLEME_YOK',
  'EKSIK_VERI'
);
