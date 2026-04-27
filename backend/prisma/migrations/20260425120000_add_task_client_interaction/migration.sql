-- CreateTable
CREATE TABLE "TaskClientInteraction" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskClientInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskClientInteraction_taskId_idx" ON "TaskClientInteraction"("taskId");

-- CreateIndex
CREATE INDEX "TaskClientInteraction_occurredAt_idx" ON "TaskClientInteraction"("occurredAt");

-- AddForeignKey
ALTER TABLE "TaskClientInteraction" ADD CONSTRAINT "TaskClientInteraction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskClientInteraction" ADD CONSTRAINT "TaskClientInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
