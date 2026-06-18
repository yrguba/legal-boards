-- Per-workspace membership attributes
ALTER TABLE "WorkspaceUser" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "WorkspaceUser" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "WorkspaceUser" ADD COLUMN "profileFields" JSONB NOT NULL DEFAULT '{}';

UPDATE "WorkspaceUser" wu
SET
  "role" = u."role",
  "departmentId" = CASE WHEN d."workspaceId" = wu."workspaceId" THEN u."departmentId" ELSE NULL END,
  "profileFields" = COALESCE(u."profileFields", '{}'::jsonb)
FROM "User" u
LEFT JOIN "Department" d ON d."id" = u."departmentId"
WHERE wu."userId" = u."id";

CREATE INDEX "WorkspaceUser_departmentId_idx" ON "WorkspaceUser"("departmentId");

ALTER TABLE "WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Workspace invites (accept-flow)
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "departmentId" TEXT,
    "groupIds" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");
CREATE INDEX "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");
CREATE INDEX "WorkspaceInvite_userId_idx" ON "WorkspaceInvite"("userId");
CREATE INDEX "WorkspaceInvite_userId_status_idx" ON "WorkspaceInvite"("userId", "status");
CREATE INDEX "WorkspaceInvite_status_idx" ON "WorkspaceInvite"("status");

ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
