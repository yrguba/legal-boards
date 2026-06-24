import { MarkdownBlockNote } from '../../../components/markdown';

type KnowledgeBlockNoteProps = {
  articleId: string;
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
};

export function KnowledgeBlockNote({ articleId, markdown, onMarkdownChange }: KnowledgeBlockNoteProps) {
  return (
    <MarkdownBlockNote
      instanceKey={articleId}
      markdown={markdown}
      onMarkdownChange={onMarkdownChange}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    />
  );
}
