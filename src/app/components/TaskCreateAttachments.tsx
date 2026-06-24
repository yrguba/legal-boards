import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { PendingAttachmentPreview, usePendingAttachmentPreviews } from './ChatAttachments';

type Props = {
  files: File[];
  onAdd: (fileList: FileList | File[] | null | undefined) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
};

export function TaskCreateAttachments({ files, onAdd, onRemove, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const previews = usePendingAttachmentPreviews(files);

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-medium text-slate-900">Вложения</h3>

      <label
        className={`block cursor-pointer rounded-lg border border-dashed px-4 py-4 transition-colors ${
          isDragging
            ? 'border-brand bg-brand-light'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (disabled) return;
          onAdd(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            const input = e.currentTarget;
            onAdd(e.target.files);
            if (input) input.value = '';
          }}
        />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Paperclip className="h-4 w-4 text-slate-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-900">
              Перетащите файл сюда или нажмите, чтобы выбрать
            </div>
            <div className="text-xs text-slate-500">Максимум 10MB на файл</div>
          </div>
        </div>
      </label>

      {previews.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {previews.map((item, index) => (
            <PendingAttachmentPreview
              key={item.key}
              name={item.file.name}
              type={item.file.type}
              previewUrl={item.previewUrl}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
