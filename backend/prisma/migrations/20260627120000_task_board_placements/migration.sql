-- CreateTable
CREATE TABLE "TaskBoardPlacement" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "linkedFromBoardId" TEXT,
    "linkedFromColumnId" TEXT,
    "linkedByRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBoardPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBoardTransition" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT,
    "fromColumnId" TEXT,
    "toColumnId" TEXT,
    "targetBoardId" TEXT,
    "targetColumnId" TEXT,
    "ruleId" TEXT,
    "ruleName" TEXT,
    "actorUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'api',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskBoardTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskBoardPlacement_taskId_boardId_key" ON "TaskBoardPlacement"("taskId", "boardId");

-- CreateIndex
CREATE INDEX "TaskBoardPlacement_boardId_columnId_idx" ON "TaskBoardPlacement"("boardId", "columnId");

-- CreateIndex
CREATE INDEX "TaskBoardPlacement_boardId_columnId_position_idx" ON "TaskBoardPlacement"("boardId", "columnId", "position");

-- CreateIndex
CREATE INDEX "TaskBoardPlacement_taskId_idx" ON "TaskBoardPlacement"("taskId");

-- CreateIndex
CREATE INDEX "TaskBoardTransition_taskId_occurredAt_idx" ON "TaskBoardTransition"("taskId", "occurredAt");

-- CreateIndex
CREATE INDEX "TaskBoardTransition_workspaceId_occurredAt_idx" ON "TaskBoardTransition"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "TaskBoardTransition_boardId_occurredAt_idx" ON "TaskBoardTransition"("boardId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TaskBoardPlacement" ADD CONSTRAINT "TaskBoardPlacement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoardPlacement" ADD CONSTRAINT "TaskBoardPlacement_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoardPlacement" ADD CONSTRAINT "TaskBoardPlacement_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoardPlacement" ADD CONSTRAINT "TaskBoardPlacement_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoardTransition" ADD CONSTRAINT "TaskBoardTransition_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoardTransition" ADD CONSTRAINT "TaskBoardTransition_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill primary placements from existing tasks
INSERT INTO "TaskBoardPlacement" (
    "id",
    "taskId",
    "boardId",
    "columnId",
    "typeId",
    "position",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    'tbpl_' || "id",
    "id",
    "boardId",
    "columnId",
    "typeId",
    "position",
    true,
    "createdAt",
    "updatedAt"
FROM "Task";
