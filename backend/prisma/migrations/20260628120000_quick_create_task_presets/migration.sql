-- CreateTable
CREATE TABLE "QuickCreateTaskPreset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickCreateTaskPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickCreateTaskPreset_workspaceId_idx" ON "QuickCreateTaskPreset"("workspaceId");

-- CreateIndex
CREATE INDEX "QuickCreateTaskPreset_workspaceId_position_idx" ON "QuickCreateTaskPreset"("workspaceId", "position");

-- CreateIndex
CREATE INDEX "QuickCreateTaskPreset_boardId_idx" ON "QuickCreateTaskPreset"("boardId");

-- AddForeignKey
ALTER TABLE "QuickCreateTaskPreset" ADD CONSTRAINT "QuickCreateTaskPreset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickCreateTaskPreset" ADD CONSTRAINT "QuickCreateTaskPreset_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
