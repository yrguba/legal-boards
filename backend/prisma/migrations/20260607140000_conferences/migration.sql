-- Видеоконференции (Jitsi)

CREATE TABLE IF NOT EXISTS "Conference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'instant',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "calendarEventId" TEXT,
    "allowGuests" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conference_roomName_key" ON "Conference"("roomName");
CREATE UNIQUE INDEX IF NOT EXISTS "Conference_shareToken_key" ON "Conference"("shareToken");
CREATE INDEX IF NOT EXISTS "Conference_workspaceId_idx" ON "Conference"("workspaceId");
CREATE INDEX IF NOT EXISTS "Conference_workspaceId_status_idx" ON "Conference"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "Conference_createdById_idx" ON "Conference"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Conference_workspaceId_fkey'
  ) THEN
    ALTER TABLE "Conference" ADD CONSTRAINT "Conference_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Conference_createdById_fkey'
  ) THEN
    ALTER TABLE "Conference" ADD CONSTRAINT "Conference_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
