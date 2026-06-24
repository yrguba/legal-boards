import { BlockNoteEditor } from '@blocknote/core';

let previewEditor: BlockNoteEditor | null = null;

function getPreviewEditor(): BlockNoteEditor {
  if (!previewEditor) {
    previewEditor = BlockNoteEditor.create();
  }
  return previewEditor;
}

/** HTML-превью через BlockNote (поддерживает тот же markdown, что и редактор). */
export function markdownToCardPreviewHtml(markdown: string): string {
  const source = markdown.trim();
  if (!source) return '';

  try {
    const editor = getPreviewEditor();
    const blocks = editor.tryParseMarkdownToBlocks(source);
    return editor.blocksToHTMLLossy(blocks);
  } catch {
    return '';
  }
}
