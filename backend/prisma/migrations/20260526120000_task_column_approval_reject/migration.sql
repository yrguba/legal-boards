-- AlterTable
ALTER TABLE "TaskColumnApproval" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "TaskColumnApproval" ADD COLUMN "reason" TEXT;
ALTER TABLE "TaskColumnApproval" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "TaskColumnApproval_status_idx" ON "TaskColumnApproval"("status");
