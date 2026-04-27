type Props = {
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
};

export function TaskMetaFooter({ creatorName, createdAt, updatedAt }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs text-slate-500">
        Создано {creatorName} • {new Date(createdAt).toLocaleString('ru-RU')}
      </div>
      {updatedAt !== createdAt && (
        <div className="text-xs text-slate-500 mt-1">
          Обновлено {new Date(updatedAt).toLocaleString('ru-RU')}
        </div>
      )}
    </div>
  );
}
