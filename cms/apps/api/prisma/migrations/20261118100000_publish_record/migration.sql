-- One row per pull request the console opened (GitHub stays the source of truth for its review status)
CREATE TABLE "PublishRecord" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "files" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublishRecord_siteId_createdAt_idx" ON "PublishRecord"("siteId", "createdAt");
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
