import { useMemo } from 'react';
import { markdownToCardPreviewHtml } from '../../utils/markdownCardPreview';

type Props = {
  markdown: string;
  className?: string;
};

/** Компактное описание на карточке доски: форматирование без растягивания карточки. */
export function TaskMarkdownPreview({ markdown, className = '' }: Props) {
  const html = useMemo(() => markdownToCardPreviewHtml(markdown), [markdown]);
  if (!html) return null;

  return (
    <div
      className={`task-card-markdown-html mb-3 min-w-0 max-w-full overflow-hidden ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
