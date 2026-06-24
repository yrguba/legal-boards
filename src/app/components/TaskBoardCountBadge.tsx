import { LayoutGrid } from 'lucide-react';

export function TaskBoardCountBadge({
  count,
  compact,
}: {
  count?: number;
  compact?: boolean;
}) {
  if (!count || count <= 1) return null;

  const label = compact ? `+${count - 1}` : `${count} доск`;

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600"
      title={`Задача на ${count} досках`}
    >
      <LayoutGrid className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
