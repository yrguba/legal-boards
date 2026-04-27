-- CreateTable
CREATE TABLE "WorkspaceChatChannel" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "departmentId" TEXT,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceChatMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceChatChannel_channelKey_key" ON "WorkspaceChatChannel"("channelKey");
CREATE INDEX "WorkspaceChatChannel_workspaceId_idx" ON "WorkspaceChatChannel"("workspaceId");
CREATE INDEX "WorkspaceChatChannel_departmentId_idx" ON "WorkspaceChatChannel"("departmentId");
CREATE INDEX "WorkspaceChatChannel_groupId_idx" ON "WorkspaceChatChannel"("groupId");
CREATE INDEX "WorkspaceChatMessage_channelId_createdAt_idx" ON "WorkspaceChatMessage"("channelId", "createdAt");
CREATE INDEX "WorkspaceChatMessage_userId_idx" ON "WorkspaceChatMessage"("userId");

ALTER TABLE "WorkspaceChatChannel" ADD CONSTRAINT "WorkspaceChatChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceChatChannel" ADD CONSTRAINT "WorkspaceChatChannel_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceChatChannel" ADD CONSTRAINT "WorkspaceChatChannel_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceChatMessage" ADD CONSTRAINT "WorkspaceChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WorkspaceChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceChatMessage" ADD CONSTRAINT "WorkspaceChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
