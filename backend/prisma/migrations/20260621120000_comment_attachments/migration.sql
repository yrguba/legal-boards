-- CreateTable
CREATE TABLE "CommentAttachment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentAttachment_commentId_idx" ON "CommentAttachment"("commentId");

-- CreateIndex
CREATE INDEX "CommentAttachment_uploadedBy_idx" ON "CommentAttachment"("uploadedBy");

-- AddForeignKey
ALTER TABLE "CommentAttachment" ADD CONSTRAINT "CommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentAttachment" ADD CONSTRAINT "CommentAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
