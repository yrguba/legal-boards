import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';

type UserLite = { id: string; name: string };

function SortableRow({
  id,
  label,
  onRemove,
}: {
  id: string;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm ${
        isDragging ? 'opacity-70 shadow-md ring-2 ring-brand/30' : ''
      }`}
    >
      <button
        type="button"
        className="touch-none cursor-grab rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Перетащить"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Удалить из списка"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function LawyerPrioritySortable({
  orderedUserIds,
  users,
  onReorder,
  onRemove,
  onAddUserId,
  instanceId = 'lawyer-priority',
}: {
  orderedUserIds: string[];
  users: UserLite[];
  onReorder: (nextIds: string[]) => void;
  onRemove: (userId: string) => void;
  onAddUserId: (userId: string) => void;
  /** Уникальный префикс для id/select при нескольких списках на странице */
  instanceId?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedUserIds.indexOf(active.id as string);
    const newIndex = orderedUserIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(orderedUserIds, oldIndex, newIndex));
  };

  const pool = users.filter((u) => !orderedUserIds.includes(u.id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Перетащите строки за иконку «⋮⋮», чтобы изменить приоритет (выше — раньше в очереди автоназначения).
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedUserIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {orderedUserIds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                Список пуст — добавьте юристов ниже
              </p>
            ) : (
              orderedUserIds.map((uid) => (
                <SortableRow
                  key={uid}
                  id={uid}
                  label={users.find((u) => u.id === uid)?.name ?? uid}
                  onRemove={() => onRemove(uid)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {pool.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${instanceId}-add`} className="text-xs text-slate-600">
            Добавить в очередь:
          </label>
          <select
            id={`${instanceId}-add`}
            className="max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            defaultValue=""
            onChange={(ev) => {
              const v = ev.target.value;
              if (v) {
                onAddUserId(v);
                ev.target.value = '';
              }
            }}
          >
            <option value="" disabled>
              Выберите пользователя…
            </option>
            {pool.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
