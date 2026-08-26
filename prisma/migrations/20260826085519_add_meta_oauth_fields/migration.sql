-- AlterTable
ALTER TABLE "Integration" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "Integration" ADD COLUMN "externalAccountId" TEXT;
ALTER TABLE "Integration" ADD COLUMN "tokenExpiresAt" DATETIME;
