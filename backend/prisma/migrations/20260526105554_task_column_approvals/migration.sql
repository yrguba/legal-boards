-- CreateTable
CREATE TABLE "TaskColumnApproval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL DEFAULT '',
    "approvedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskColumnApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskColumnApproval_taskId_idx" ON "TaskColumnApproval"("taskId");

-- CreateIndex
CREATE INDEX "TaskColumnApproval_columnId_idx" ON "TaskColumnApproval"("columnId");

-- CreateIndex
CREATE INDEX "TaskColumnApproval_approvedByUserId_idx" ON "TaskColumnApproval"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskColumnApproval_taskId_ruleId_key" ON "TaskColumnApproval"("taskId", "ruleId");

-- AddForeignKey
ALTER TABLE "TaskColumnApproval" ADD CONSTRAINT "TaskColumnApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskColumnApproval" ADD CONSTRAINT "TaskColumnApproval_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
