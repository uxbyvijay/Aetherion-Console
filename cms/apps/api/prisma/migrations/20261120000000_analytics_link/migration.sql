-- CreateTable
CREATE TABLE "AnalyticsLink" (
    "siteId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secretEnc" TEXT,
    "connectedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsLink_pkey" PRIMARY KEY ("siteId")
);

-- AddForeignKey
ALTER TABLE "AnalyticsLink" ADD CONSTRAINT "AnalyticsLink_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
