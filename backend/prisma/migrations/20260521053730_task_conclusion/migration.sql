-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "conclusionText" TEXT;

-- AlterTable
ALTER TABLE "TaskAttachment" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'general';

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_purpose_idx" ON "TaskAttachment"("taskId", "purpose");
