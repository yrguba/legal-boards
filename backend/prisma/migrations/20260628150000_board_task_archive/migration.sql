-- AlterTable
ALTER TABLE "Board" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedById" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedById" TEXT,
ADD COLUMN "archivedWithBoardId" TEXT;

-- CreateIndex
CREATE INDEX "Board_archivedAt_idx" ON "Board"("archivedAt");

-- CreateIndex
CREATE INDEX "Board_workspaceId_archivedAt_idx" ON "Board"("workspaceId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_archivedAt_idx" ON "Task"("archivedAt");

-- CreateIndex
CREATE INDEX "Task_boardId_archivedAt_idx" ON "Task"("boardId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_archivedWithBoardId_idx" ON "Task"("archivedWithBoardId");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
