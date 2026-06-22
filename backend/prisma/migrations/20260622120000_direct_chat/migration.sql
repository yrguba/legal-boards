-- AlterTable
ALTER TABLE "WorkspaceChatChannel" ADD COLUMN "directUserIds" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "WorkspaceChatChannel_workspaceId_scope_idx" ON "WorkspaceChatChannel"("workspaceId", "scope");
