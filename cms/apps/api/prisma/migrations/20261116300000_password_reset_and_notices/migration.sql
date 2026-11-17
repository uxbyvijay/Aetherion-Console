-- Codes emailed to people who forgot their password, and notes for admins about password changes
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

CREATE TABLE "AccountNotice" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountNotice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountNotice_createdAt_idx" ON "AccountNotice"("createdAt");
