-- Where a website is hosted: kept as a record for the team
ALTER TABLE "Site" ADD COLUMN "dnsName" TEXT;
ALTER TABLE "Site" ADD COLUMN "serverName" TEXT;
ALTER TABLE "Site" ADD COLUMN "serverPort" INTEGER;
ALTER TABLE "Site" ADD COLUMN "serverIp" TEXT;
