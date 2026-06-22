-- Индекс мог быть удалён drift-миграцией 20260622083929_ до синхронизации.
CREATE INDEX IF NOT EXISTS "WorkspaceChatChannel_workspaceId_scope_idx" ON "WorkspaceChatChannel"("workspaceId", "scope");
