import '@mantine/core/styles.css';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';
import type { PartialBlock } from '@blocknote/core';
import { blocksToMarkdown, markdownToBlocks } from '@blocknote/core';
import { ru } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote, useEditorChange } from '@blocknote/react';
import { useLayoutEffect, useMemo } from 'react';

type KnowledgeBlockNoteProps = {
  articleId: string;
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
};

/** BlockNote + Mantine UI: slash‑меню и форматирование «из коробки». Контент в БД — Markdown. */
export function KnowledgeBlockNote({ articleId, markdown, onMarkdownChange }: KnowledgeBlockNoteProps) {
  const editor = useCreateBlockNote(
    {
      dictionary: ru,
      trailingBlock: true,
    },
    [articleId],
  );

  useLayoutEffect(() => {
    try {
      const blocks = markdownToBlocks(markdown || '', editor.pmSchema);
      const cur = editor.document;
      editor.replaceBlocks(
        cur.map((b) => b.id),
        blocks as PartialBlock<any, any, any>[],
      );
    } catch {
      editor.replaceBlocks(editor.document.map((b) => b.id), [{ type: 'paragraph' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, editor]);

  useEditorChange(() => {
    try {
      const md = blocksToMarkdown(editor.document, editor.pmSchema, editor, {
        document: typeof document !== 'undefined' ? document : undefined,
      });
      onMarkdownChange(md);
    } catch {
      /* ignore */
    }
  }, editor);

  const wrapClass = useMemo(() => 'bn-knowledge-scope flex min-h-0 flex-1 flex-col overflow-hidden', []);

  return (
    <div className={wrapClass}>
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}
