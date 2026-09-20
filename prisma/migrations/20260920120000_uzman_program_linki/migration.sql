-- §17.8 — Uzmanın giriş gerektirmeyen haftalık program adresi.
-- Jeton adresin kendisidir; boş olmak normal (link üretilmemiş uzman).
ALTER TABLE "Uzman" ADD COLUMN "programJetonu" TEXT;
ALTER TABLE "Uzman" ADD COLUMN "programSonGoruntuleme" TIMESTAMP(3);

CREATE UNIQUE INDEX "Uzman_programJetonu_key" ON "Uzman"("programJetonu");
