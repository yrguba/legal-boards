-- CreateTable
CREATE TABLE "WorkspaceChatMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceChatMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceChatMessageAttachment_messageId_idx" ON "WorkspaceChatMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "WorkspaceChatMessageAttachment_uploadedBy_idx" ON "WorkspaceChatMessageAttachment"("uploadedBy");

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessageAttachment" ADD CONSTRAINT "WorkspaceChatMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WorkspaceChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessageAttachment" ADD CONSTRAINT "WorkspaceChatMessageAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
