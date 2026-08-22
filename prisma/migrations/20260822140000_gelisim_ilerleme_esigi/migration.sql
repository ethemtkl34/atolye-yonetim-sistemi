-- §11.2 — Dönem ortası → dönem sonu ilerlemesinin "anlamlı fark" eşiği.
--
-- Ayrı bir alan, `gelisimFarkEsigi`nin tekrarı değil: o eşik ÖĞRENCİ ile GRUP
-- arasındaki farkı ölçüyor (akran kıyası), bu eşik aynı öğrencinin İKİ ÖLÇÜM
-- arasındaki değişimini. İkisini tek sayıya bağlamak, akran kıyasını
-- hassaslaştırmak isteyen kişinin farkında olmadan ilerleme cümlelerini de
-- değiştirmesi demekti.
ALTER TABLE "RaporAyari"
  ADD COLUMN "gelisimIlerlemeEsigi" DOUBLE PRECISION NOT NULL DEFAULT 0.3;
