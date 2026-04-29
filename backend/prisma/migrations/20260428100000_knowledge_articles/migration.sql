-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeArticle_workspaceId_idx" ON "KnowledgeArticle"("workspaceId");
CREATE INDEX "KnowledgeArticle_parentId_idx" ON "KnowledgeArticle"("parentId");

ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
