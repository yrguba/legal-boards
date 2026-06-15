import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { conferencesApi } from '../../services/api';
import type { Conference } from '../../types';

export type WorkspaceMemberOption = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: WorkspaceMemberOption[];
  onSaved: () => void;
  conference?: Conference | null;
};

function toLocalInput(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function formatNotifyStats(stats?: {
  notifications?: number;
  emails?: number;
  emailsFailed?: number;
}): string | null {
  if (!stats) return null;
  const parts = [`уведомлений: ${stats.notifications ?? 0}`, `писем: ${stats.emails ?? 0}`];
  if (stats.emailsFailed) parts.push(`ошибок email: ${stats.emailsFailed}`);
  return parts.join(', ');
}

export function ScheduleConferenceModal({
  open,
  onClose,
  workspaceId,
  members,
  onSaved,
  conference,
}: Props) {
  const isEdit = !!conference;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (conference) {
      setTitle(conference.title);
      setDescription(conference.description ?? '');
      setStart(toLocalInput(new Date(conference.startAt)));
      setEnd(conference.endAt ? toLocalInput(new Date(conference.endAt)) : '');
      setAttendeeIds(new Set(conference.attendeeIds ?? []));
    } else {
      const base = new Date();
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
      const s = new Date(base);
      const e = new Date(base);
      e.setHours(e.getHours() + 1);
      setTitle('');
      setDescription('');
      setStart(toLocalInput(s));
      setEnd(toLocalInput(e));
      setAttendeeIds(new Set());
    }
    setErr(null);
  }, [open, conference]);

  if (!open) return null;

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const startD = new Date(start);
    const endD = new Date(end);
    if (!title.trim() || isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD <= startD) {
      setErr('Проверьте название и время: конец должен быть позже начала');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && conference) {
        const result = await conferencesApi.update(conference.id, {
          title: title.trim(),
          description: description.trim() || null,
          startAt: startD.toISOString(),
          endAt: endD.toISOString(),
          attendeeIds: Array.from(attendeeIds),
        });
        const statsMsg = formatNotifyStats(result.notifyStats);
        if (statsMsg) window.alert(`Изменения сохранены (${statsMsg})`);
      } else {
        const result = await conferencesApi.createScheduled({
          workspaceId,
          title: title.trim(),
          description: description.trim() || null,
          startAt: startD.toISOString(),
          endAt: endD.toISOString(),
          attendeeIds: Array.from(attendeeIds),
        });
        const statsMsg = formatNotifyStats(result.inviteStats);
        if (statsMsg) window.alert(`Конференция запланирована (${statsMsg})`);
      }
      onSaved();
      onClose();
    } catch (x) {
      setErr(x instanceof Error ? x.message : isEdit ? 'Ошибка сохранения' : 'Ошибка планирования');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Изменить конференцию' : 'Запланировать конференцию'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isEdit
                ? 'Участники получат уведомление об изменениях'
                : 'Участники получат уведомление и письмо на email'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            aria-label="Закрыть"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[72px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Начало</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Конец</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Участники</div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {members.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">Нет сотрудников в пространстве</div>
              ) : (
                members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={attendeeIds.has(m.id)}
                      onChange={() => toggleAttendee(m.id)}
                    />
                    <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-xs text-brand font-medium flex-shrink-0">
                      {m.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900 truncate">{m.name}</div>
                      <div className="text-xs text-slate-500 truncate">{m.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
            >
              Закрыть
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-brand text-white disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Запланировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
