import { priorityStyle, taskPriorityLabel } from '../utils/taskPriority';

type Props = {
  priority?: string | null;
  compact?: boolean;
  className?: string;
};

export function TaskPriorityBadge({ priority, compact, className = '' }: Props) {
  const label = taskPriorityLabel(priority);
  const style = priorityStyle(priority);

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${style.bg} ${style.text} ${style.border} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      {label}
    </span>
  );
}
