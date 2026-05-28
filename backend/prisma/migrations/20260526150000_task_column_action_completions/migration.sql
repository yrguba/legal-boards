-- CreateTable
CREATE TABLE "TaskColumnActionCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL DEFAULT '',
    "actionKind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "completedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskColumnActionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskColumnActionCompletion_taskId_idx" ON "TaskColumnActionCompletion"("taskId");

-- CreateIndex
CREATE INDEX "TaskColumnActionCompletion_columnId_idx" ON "TaskColumnActionCompletion"("columnId");

-- CreateIndex
CREATE INDEX "TaskColumnActionCompletion_completedByUserId_idx" ON "TaskColumnActionCompletion"("completedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskColumnActionCompletion_taskId_ruleId_key" ON "TaskColumnActionCompletion"("taskId", "ruleId");

-- AddForeignKey
ALTER TABLE "TaskColumnActionCompletion" ADD CONSTRAINT "TaskColumnActionCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskColumnActionCompletion" ADD CONSTRAINT "TaskColumnActionCompletion_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
