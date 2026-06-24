import '@mantine/core/styles.css';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';
import { MantineProvider } from '@mantine/core';
import type { PartialBlock } from '@blocknote/core';
import { blocksToMarkdown, markdownToBlocks } from '@blocknote/core';
import { ru } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote, useEditorChange } from '@blocknote/react';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

type MarkdownBlockNoteProps = {
  instanceKey: string;
  markdown: string;
  onMarkdownChange?: (markdown: string) => void;
  compact?: boolean;
  className?: string;
};

function loadMarkdownIntoEditor(
  editor: ReturnType<typeof useCreateBlockNote>,
  markdown: string,
): void {
  try {
    const blocks = markdownToBlocks(markdown || '', editor.pmSchema);
    editor.replaceBlocks(
      editor.document.map((b) => b.id),
      blocks as PartialBlock<any, any, any>[],
    );
  } catch {
    editor.replaceBlocks(editor.document.map((b) => b.id), [{ type: 'paragraph' }]);
  }
}

/** BlockNote + Mantine: slash-меню и форматирование. Контент — Markdown. */
export function MarkdownBlockNote({
  instanceKey,
  markdown,
  onMarkdownChange,
  compact = false,
  className = '',
}: MarkdownBlockNoteProps) {
  const editable = Boolean(onMarkdownChange);

  const editor = useCreateBlockNote(
    {
      dictionary: ru,
      trailingBlock: editable,
    },
    [instanceKey],
  );

  useLayoutEffect(() => {
    loadMarkdownIntoEditor(editor, markdown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey, editor]);

  useLayoutEffect(() => {
    if (editable) return;
    loadMarkdownIntoEditor(editor, markdown);
  }, [editable, markdown, editor]);

  useEditorChange(() => {
    if (!onMarkdownChange) return;
    try {
      const md = blocksToMarkdown(editor.document, editor.pmSchema, editor, {
        document: typeof document !== 'undefined' ? document : undefined,
      });
      onMarkdownChange(md);
    } catch {
      /* ignore */
    }
  }, editor);

  const portalHostRef = useRef<HTMLDivElement>(null);

  // BlockNote по умолчанию вешает portal на document.body — в Radix Dialog он inert.
  useEffect(() => {
    const host = portalHostRef.current;
    if (!host) return;

    const movePortal = () => {
      const portal = editor.portalElement;
      if (portal.parentElement !== host) {
        host.appendChild(portal);
      }
    };

    movePortal();
    return editor.onMount(movePortal);
  }, [editor, instanceKey]);

  const scopeClass = [
    'bn-markdown-scope',
    compact ? 'bn-markdown-compact' : '',
    !editable ? 'bn-markdown-readonly' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={scopeClass}>
      <BlockNoteView
        editor={editor}
        theme="light"
        editable={editable}
        sideMenu={editable}
        formattingToolbar={editable}
        linkToolbar={editable}
      />
      <div ref={portalHostRef} className="bn-portal-host" aria-hidden />
    </div>
  );
}

export function MarkdownEditorRoot({ children }: { children: ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}
