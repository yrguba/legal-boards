import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

function formatElapsedSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function TaskElapsedTimeDisplay({
  trackedSeconds,
  activeSinceIso,
  compact,
}: {
  trackedSeconds: number;
  activeSinceIso?: string | null;
  compact?: boolean;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!activeSinceIso) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeSinceIso]);

  const liveExtra =
    activeSinceIso
      ? Math.max(0, Math.floor((Date.now() - new Date(activeSinceIso).getTime()) / 1000))
      : 0;

  const displaySeconds = (trackedSeconds ?? 0) + liveExtra;

  const inner = (
    <>
      <Clock className={compact ? 'size-3.5 shrink-0 text-slate-500' : 'size-4 shrink-0 text-slate-500'} />
      <span
        className={
          compact ? 'tabular-nums text-xs font-medium text-slate-700' : 'tabular-nums text-sm font-medium text-slate-800'
        }
      >
        {formatElapsedSeconds(displaySeconds)}
      </span>
    </>
  );

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-700"
        title="Затраченное время по правилам доски"
      >
        {inner}
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
      title="Затраченное время по правилам доски"
    >
      {inner}
    </div>
  );
}
