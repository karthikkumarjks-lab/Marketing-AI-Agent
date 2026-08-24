-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "objective" TEXT,
    "monthlyBudgetInr" INTEGER,
    "websiteUrl" TEXT,
    "icpNotes" TEXT,
    "currentChannels" TEXT,
    "marketingAssets" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "inputsSpec" TEXT NOT NULL,
    "outputsSpec" TEXT NOT NULL,
    "triggerNotes" TEXT,
    "isWired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "inputContext" TEXT NOT NULL,
    "outputMarkdown" TEXT NOT NULL,
    "predictedOutcome" TEXT,
    "actualOutcome" TEXT,
    "outcomeStatus" TEXT NOT NULL DEFAULT 'pending',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NeedsAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "recommendedStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NeedsAnalysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NeedsAnalysis_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_key_key" ON "Agent"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NeedsAnalysis_workspaceId_agentId_key" ON "NeedsAnalysis"("workspaceId", "agentId");
