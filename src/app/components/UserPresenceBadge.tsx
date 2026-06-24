import { formatPresenceLabel, presenceDotClass } from '../utils/userPresence';
import type { UserPresenceInfo } from '../types';

type Props = {
  presence: UserPresenceInfo | null | undefined;
  className?: string;
  showLabel?: boolean;
};

export function UserPresenceBadge({ presence, className = '', showLabel = true }: Props) {
  const label = formatPresenceLabel(presence);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-slate-600 ${className}`}
      title={label}
    >
      <span className={`size-2 shrink-0 rounded-full ${presenceDotClass(presence)}`} aria-hidden />
      {showLabel ? <span className="truncate">{label}</span> : null}
    </span>
  );
}
