-- Hafta sayısı artık sabit 10 değil (kurallar.ts: EN_AZ_HAFTA = 1,
-- EN_FAZLA_HAFTA = 52) ama ilk şemadan kalan CHECK kısıtları 1..10'da
-- kalmıştı: 10 haftadan uzun bir dönem açmak ya da 10. haftadan sonra grup
-- eklemek uygulama doğrulamasından geçip veritabanında ham hatayla
-- patlıyordu. Sınırlar uygulama kuralıyla eşitlenir; "son savunma hattı"
-- ilkesi (coklu_rol migration'ı) korunur.

ALTER TABLE "TermWeek" DROP CONSTRAINT "TermWeek_weekNumber_araligi";
ALTER TABLE "TermWeek" ADD CONSTRAINT "TermWeek_weekNumber_araligi"
  CHECK ("weekNumber" BETWEEN 1 AND 52);

ALTER TABLE "Group" DROP CONSTRAINT "Group_startWeekNumber_araligi";
ALTER TABLE "Group" ADD CONSTRAINT "Group_startWeekNumber_araligi"
  CHECK ("startWeekNumber" BETWEEN 1 AND 52);
