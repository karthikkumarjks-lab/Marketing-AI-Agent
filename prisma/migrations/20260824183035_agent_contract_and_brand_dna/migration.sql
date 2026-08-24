-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "aov" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "cacTarget" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "conversionTarget" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "cplTarget" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "existingStack" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "grossMarginPct" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "guardrails" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "ltv" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "maturityStage" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "northStarKpi" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "retentionTarget" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "revenueTarget" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "roasTarget" REAL;
ALTER TABLE "Workspace" ADD COLUMN "salesCapacity" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "salesCycleDays" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "seasonality" TEXT;

-- CreateTable
CREATE TABLE "BrandDNA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "typography" TEXT,
    "visualStyle" TEXT,
    "brandPersonality" TEXT,
    "toneOfVoice" TEXT,
    "positioning" TEXT,
    "approvedClaims" TEXT,
    "restrictedClaims" TEXT,
    "dos" TEXT,
    "donts" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandDNA_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NeedsAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "recommendedStatus" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'idle',
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "reactivationTrigger" TEXT,
    "overriddenStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NeedsAnalysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NeedsAnalysis_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NeedsAnalysis" ("agentId", "createdAt", "id", "overriddenStatus", "reason", "recommendedStatus", "workspaceId") SELECT "agentId", "createdAt", "id", "overriddenStatus", "reason", "recommendedStatus", "workspaceId" FROM "NeedsAnalysis";
DROP TABLE "NeedsAnalysis";
ALTER TABLE "new_NeedsAnalysis" RENAME TO "NeedsAnalysis";
CREATE UNIQUE INDEX "NeedsAnalysis_workspaceId_agentId_key" ON "NeedsAnalysis"("workspaceId", "agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BrandDNA_workspaceId_key" ON "BrandDNA"("workspaceId");
