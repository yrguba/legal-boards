import type { ReactNode } from 'react';
import { iterCommentMentionTokens } from '../utils/commentMentions';

export function CommentPlainWithMentions({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of iterCommentMentionTokens(content)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {content.slice(lastIndex, start)}
        </span>,
      );
    }
    parts.push(
      <span
        key={key++}
        className="font-medium text-brand"
        title={match[2] ? `Упоминание: ${match[1]}` : undefined}
      >
        @{match[1]}
      </span>,
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </span>,
    );
  }

  if (parts.length === 0) {
    return <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{content}</div>;
  }

  return <div className="text-sm text-slate-700 leading-relaxed">{parts}</div>;
}
