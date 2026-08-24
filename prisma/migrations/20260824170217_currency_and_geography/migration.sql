/*
  Warnings:

  - You are about to drop the column `monthlyBudgetInr` on the `Workspace` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "objective" TEXT,
    "monthlyBudget" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country" TEXT,
    "websiteUrl" TEXT,
    "icpNotes" TEXT,
    "currentChannels" TEXT,
    "marketingAssets" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workspace" ("createdAt", "currentChannels", "icpNotes", "id", "industry", "marketingAssets", "name", "objective", "updatedAt", "websiteUrl") SELECT "createdAt", "currentChannels", "icpNotes", "id", "industry", "marketingAssets", "name", "objective", "updatedAt", "websiteUrl" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
