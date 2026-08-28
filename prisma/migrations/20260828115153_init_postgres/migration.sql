-- CreateEnum
CREATE TYPE "OutcomeStatus" AS ENUM ('pending', 'matched', 'missed');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
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
    "aov" INTEGER,
    "ltv" INTEGER,
    "grossMarginPct" INTEGER,
    "salesCycleDays" INTEGER,
    "salesCapacity" TEXT,
    "cacTarget" INTEGER,
    "cplTarget" INTEGER,
    "roasTarget" DOUBLE PRECISION,
    "revenueTarget" INTEGER,
    "conversionTarget" TEXT,
    "retentionTarget" TEXT,
    "northStarKpi" TEXT,
    "guardrails" TEXT,
    "seasonality" TEXT,
    "existingStack" TEXT,
    "maturityStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_connected',
    "accountLabel" TEXT,
    "connectedAt" TIMESTAMP(3),
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "externalAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandDNA" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDNA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "inputsSpec" TEXT NOT NULL,
    "outputsSpec" TEXT NOT NULL,
    "triggerNotes" TEXT,
    "isWired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceInr" INTEGER,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "inputContext" TEXT NOT NULL,
    "outputMarkdown" TEXT NOT NULL,
    "predictedOutcome" TEXT,
    "actualOutcome" TEXT,
    "outcomeStatus" "OutcomeStatus" NOT NULL DEFAULT 'pending',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeedsAnalysis" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "recommendedStatus" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'idle',
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "reactivationTrigger" TEXT,
    "overriddenStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeedsAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_workspaceId_provider_key" ON "Integration"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "BrandDNA_workspaceId_key" ON "BrandDNA"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_key_key" ON "Agent"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NeedsAnalysis_workspaceId_agentId_key" ON "NeedsAnalysis"("workspaceId", "agentId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDNA" ADD CONSTRAINT "BrandDNA_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedsAnalysis" ADD CONSTRAINT "NeedsAnalysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedsAnalysis" ADD CONSTRAINT "NeedsAnalysis_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
