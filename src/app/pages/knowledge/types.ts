export type KnowledgeArticle = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  body: string;
  position: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ArticleRow = KnowledgeArticle & { depth: number };
