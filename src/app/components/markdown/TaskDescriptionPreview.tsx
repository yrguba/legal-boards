import { TaskMarkdownPreview } from './TaskMarkdownPreview';

type Props = {
  text: string;
  markdown?: boolean;
  className?: string;
};

/** Превью описания задачи: BlockNote или plain text. */
export function TaskDescriptionPreview({ text, markdown = false, className = '' }: Props) {
  if (!text.trim()) return null;
  if (markdown) {
    return <TaskMarkdownPreview markdown={text} className={className} />;
  }
  return (
    <p
      className={`mb-3 min-w-0 max-w-full overflow-hidden text-sm text-slate-600 whitespace-pre-wrap line-clamp-4 ${className}`}
    >
      {text}
    </p>
  );
}
