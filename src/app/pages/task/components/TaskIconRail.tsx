import { t } from '../taskPage.classes';
import type { TaskPanelType } from '../types';
import type { TaskSidebarRailEntry } from '../constants';

type Props = {
  entries: TaskSidebarRailEntry[];
  activePanel: TaskPanelType;
  onSelect: (id: TaskPanelType) => void;
};

export function TaskIconRail({ entries, activePanel, onSelect }: Props) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-l border-slate-200 bg-slate-50 py-2">
      {entries.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => onSelect(id)}
          className={t.iconRailBtn(activePanel === id)}
        >
          <Icon className="size-5" />
        </button>
      ))}
    </div>
  );
}
