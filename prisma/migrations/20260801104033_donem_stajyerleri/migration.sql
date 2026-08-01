-- CreateTable
CREATE TABLE "TermIntern" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermIntern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermIntern_userId_idx" ON "TermIntern"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TermIntern_termId_userId_key" ON "TermIntern"("termId", "userId");

-- AddForeignKey
ALTER TABLE "TermIntern" ADD CONSTRAINT "TermIntern_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermIntern" ADD CONSTRAINT "TermIntern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
