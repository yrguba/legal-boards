-- Отдельные пользователи LEXPRO и связь с workspace только после первой задачи

CREATE TABLE "LexClientUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientKind" TEXT NOT NULL,
    "companyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LexClientUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LexClientUser_email_key" ON "LexClientUser"("email");

CREATE TABLE "LexClientWorkspace" (
    "id" TEXT NOT NULL,
    "lexClientId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LexClientWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LexClientWorkspace_lexClientId_workspaceId_key" ON "LexClientWorkspace"("lexClientId", "workspaceId");
CREATE INDEX "LexClientWorkspace_workspaceId_idx" ON "LexClientWorkspace"("workspaceId");
CREATE INDEX "LexClientWorkspace_lexClientId_idx" ON "LexClientWorkspace"("lexClientId");

ALTER TABLE "LexClientWorkspace" ADD CONSTRAINT "LexClientWorkspace_lexClientId_fkey" FOREIGN KEY ("lexClientId") REFERENCES "LexClientUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LexClientWorkspace" ADD CONSTRAINT "LexClientWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LexClientUser" ("id", "email", "password", "name", "clientKind", "companyName", "createdAt", "updatedAt")
SELECT "id", "email", "password", "name", COALESCE("lexClientKind", 'individual'), "companyName", "createdAt", "updatedAt"
FROM "User"
WHERE "role" = 'client';

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_createdBy_fkey";

ALTER TABLE "Task" ADD COLUMN "lexCreatorId" TEXT;

UPDATE "Task"
SET "lexCreatorId" = "createdBy", "createdBy" = NULL
WHERE "createdBy" IN (SELECT "id" FROM "LexClientUser");

ALTER TABLE "Task" ALTER COLUMN "createdBy" DROP NOT NULL;

CREATE INDEX "Task_lexCreatorId_idx" ON "Task"("lexCreatorId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_lexCreatorId_fkey" FOREIGN KEY ("lexCreatorId") REFERENCES "LexClientUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" DROP CONSTRAINT IF EXISTS "ChatMessage_userId_fkey";

ALTER TABLE "ChatMessage" ADD COLUMN "lexClientUserId" TEXT;
ALTER TABLE "ChatMessage" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "ChatMessage_lexClientUserId_idx" ON "ChatMessage"("lexClientUserId");

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_lexClientUserId_fkey" FOREIGN KEY ("lexClientUserId") REFERENCES "LexClientUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAttachment" DROP CONSTRAINT IF EXISTS "TaskAttachment_uploadedBy_fkey";

ALTER TABLE "TaskAttachment" ADD COLUMN "uploadedByLexClientId" TEXT;
ALTER TABLE "TaskAttachment" ALTER COLUMN "uploadedBy" DROP NOT NULL;

CREATE INDEX "TaskAttachment_uploadedByLexClientId_idx" ON "TaskAttachment"("uploadedByLexClientId");

ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_uploadedByLexClientId_fkey" FOREIGN KEY ("uploadedByLexClientId") REFERENCES "LexClientUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DELETE FROM "WorkspaceUser" WHERE "userId" IN (SELECT "id" FROM "LexClientUser");
DELETE FROM "Notification" WHERE "userId" IN (SELECT "id" FROM "LexClientUser");

DELETE FROM "User" WHERE "id" IN (SELECT "id" FROM "LexClientUser");

ALTER TABLE "User" DROP COLUMN IF EXISTS "lexClientKind";
ALTER TABLE "User" DROP COLUMN IF EXISTS "companyName";
