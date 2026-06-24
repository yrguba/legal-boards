import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  CalendarOff,
  Camera,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { usersApi, ApiError } from '../services/api';
import { resolveUserAvatarUrl } from '../utils/userAvatar';
import {
  ABSENCE_KIND_OPTIONS,
  PRESENCE_OPTIONS,
  absenceKindLabel,
  endOfTodayIso,
  formatAbsenceRange,
  notifyPresenceUpdated,
} from '../utils/userPresence';
import type { UserAbsence, UserPresenceInfo, UserPresenceStatus } from '../types';
import { UserPresenceBadge } from './UserPresenceBadge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

type SettableStatus = Exclude<UserPresenceStatus, 'vacation'>;

export function MyProfileSettingsPanel() {
  const { currentUser, currentWorkspace, setCurrentUser } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(currentUser?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [presence, setPresence] = useState<UserPresenceInfo | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<SettableStatus>('available');
  const [customText, setCustomText] = useState('');
  const [statusUntilEndOfDay, setStatusUntilEndOfDay] = useState(false);
  const [savingPresence, setSavingPresence] = useState(false);
  const [loadingPresence, setLoadingPresence] = useState(false);

  const [absences, setAbsences] = useState<UserAbsence[]>([]);
  const [loadingAbsences, setLoadingAbsences] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceKind, setAbsenceKind] = useState('vacation');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');
  const [absenceNote, setAbsenceNote] = useState('');
  const [substituteUserId, setSubstituteUserId] = useState('');
  const [colleagues, setColleagues] = useState<{ id: string; name: string }[]>([]);
  const [savingAbsence, setSavingAbsence] = useState(false);

  const workspaceId = currentWorkspace?.id ?? '';

  const loadPresenceData = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingPresence(true);
    setLoadingAbsences(true);
    try {
      const [presenceRes, absencesRes, members] = await Promise.all([
        usersApi.getMyPresence(workspaceId),
        usersApi.getMyAbsences(workspaceId),
        usersApi.getByWorkspace(workspaceId),
      ]);
      setPresence(presenceRes.presence);
      setAbsences(absencesRes.absences);
      setColleagues(
        members
          .filter((m: { id: string }) => m.id !== currentUser?.id)
          .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })),
      );

      const storedStatus = presenceRes.presence.onAbsence
        ? 'available'
        : (PRESENCE_OPTIONS.some((o) => o.value === presenceRes.presence.status)
            ? (presenceRes.presence.status as SettableStatus)
            : 'available');
      setPresenceStatus(storedStatus);
      setCustomText(presenceRes.presence.customText ?? '');
      setStatusUntilEndOfDay(Boolean(presenceRes.presence.expiresAt));
    } catch {
      setError('Не удалось загрузить статус и отпуска');
    } finally {
      setLoadingPresence(false);
      setLoadingAbsences(false);
    }
  }, [workspaceId, currentUser?.id]);

  useEffect(() => {
    void loadPresenceData();
  }, [loadPresenceData]);

  if (!currentUser) {
    return <p className="text-sm text-slate-500">Войдите в систему.</p>;
  }

  if (!workspaceId) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-sm text-slate-600">Выберите рабочее пространство в шапке приложения.</p>
      </div>
    );
  }

  const avatarUrl = resolveUserAvatarUrl(currentUser.avatar);
  const nameDirty = name.trim() !== currentUser.name;
  const initial = currentUser.name.charAt(0).toUpperCase() || '?';

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Имя не может быть пустым');
      return;
    }
    setSavingName(true);
    setError(null);
    setSuccess(null);
    try {
      const { user } = await usersApi.updateMe({ name: trimmed });
      setCurrentUser({ ...currentUser, ...user });
      setName(user.name);
      setSuccess('Имя сохранено');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить имя');
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarPick = () => fileRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите файл изображения');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Размер файла не более 2 МБ');
      return;
    }
    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);
    try {
      const { user } = await usersApi.uploadAvatar(file);
      setCurrentUser({ ...currentUser, ...user });
      setSuccess('Аватар обновлён');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить аватар');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentUser.avatar) return;
    if (!confirm('Удалить аватар?')) return;
    setRemovingAvatar(true);
    setError(null);
    setSuccess(null);
    try {
      const { user } = await usersApi.deleteAvatar();
      setCurrentUser({ ...currentUser, ...user });
      setSuccess('Аватар удалён');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить аватар');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSavePresence = async () => {
    setSavingPresence(true);
    setError(null);
    setSuccess(null);
    try {
      const { presence: next } = await usersApi.updateMyPresence({
        workspaceId,
        status: presenceStatus,
        customText: presenceStatus === 'custom' ? customText.trim() : undefined,
        expiresAt: statusUntilEndOfDay ? endOfTodayIso() : null,
      });
      setPresence(next);
      notifyPresenceUpdated();
      setSuccess('Статус сохранён');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить статус');
    } finally {
      setSavingPresence(false);
    }
  };

  const handleCreateAbsence = async () => {
    setSavingAbsence(true);
    setError(null);
    setSuccess(null);
    try {
      const { absences: next, presence: nextPresence } = await usersApi.createAbsence({
        workspaceId,
        kind: absenceKind,
        startDate: absenceStart,
        endDate: absenceEnd,
        note: absenceNote.trim() || undefined,
        substituteUserId: substituteUserId || undefined,
      });
      setAbsences(next);
      setPresence(nextPresence);
      notifyPresenceUpdated();
      setShowAbsenceForm(false);
      setAbsenceStart('');
      setAbsenceEnd('');
      setAbsenceNote('');
      setSubstituteUserId('');
      setSuccess('Период отсутствия добавлен');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось добавить отсутствие');
    } finally {
      setSavingAbsence(false);
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (!confirm('Удалить запись об отсутствии?')) return;
    setError(null);
    setSuccess(null);
    try {
      const { absences: next, presence: nextPresence } = await usersApi.deleteAbsence(
        id,
        workspaceId,
      );
      setAbsences(next);
      setPresence(nextPresence);
      notifyPresenceUpdated();
      setSuccess('Запись удалена');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Мой профиль</h2>
        <p className="text-sm text-slate-600">
          Настройки аккаунта для пространства «{currentWorkspace?.name}».
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      ) : null}

      <section className="flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar className="size-20 border border-slate-200">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={currentUser.name} /> : null}
          <AvatarFallback className="bg-brand-light text-brand text-2xl font-medium">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void handleAvatarChange(e)}
          />
          <button
            type="button"
            onClick={handleAvatarPick}
            disabled={uploadingAvatar || removingAvatar}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {uploadingAvatar ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {uploadingAvatar ? 'Загрузка…' : 'Загрузить фото'}
          </button>
          {currentUser.avatar ? (
            <button
              type="button"
              onClick={() => void handleRemoveAvatar()}
              disabled={uploadingAvatar || removingAvatar}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {removingAvatar ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Удалить
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 max-w-lg">
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1">
            Имя в системе
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            maxLength={128}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <p className="text-sm text-slate-900">{currentUser.email}</p>
        </div>
        <button
          type="button"
          disabled={!nameDirty || savingName}
          onClick={() => void handleSaveName()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
          {savingName ? 'Сохранение…' : 'Сохранить имя'}
        </button>
      </section>

      <section className="border-t border-slate-200 pt-6 space-y-4 max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Статус</h3>
          {loadingPresence ? (
            <Loader2 className="size-4 animate-spin text-slate-400" />
          ) : (
            <UserPresenceBadge presence={presence} />
          )}
        </div>
        {presence?.onAbsence ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Сейчас активен период отсутствия ({absenceKindLabel(presence.absenceKind)}). Коллеги
            видят вас как недоступного до его окончания.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="presence-status" className="block text-sm font-medium text-slate-700 mb-1">
                Ваш статус
              </label>
              <select
                id="presence-status"
                value={presenceStatus}
                onChange={(e) => setPresenceStatus(e.target.value as SettableStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {PRESENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {presenceStatus === 'custom' ? (
              <div>
                <label htmlFor="custom-status" className="block text-sm font-medium text-slate-700 mb-1">
                  Текст статуса
                </label>
                <input
                  id="custom-status"
                  type="text"
                  maxLength={60}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Например: На суде"
                />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={statusUntilEndOfDay}
                onChange={(e) => setStatusUntilEndOfDay(e.target.checked)}
              />
              Сбросить статус в конце дня
            </label>
            <button
              type="button"
              disabled={savingPresence || loadingPresence}
              onClick={() => void handleSavePresence()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {savingPresence ? <Loader2 className="size-4 animate-spin" /> : null}
              Сохранить статус
            </button>
          </>
        )}
      </section>

      <section className="border-t border-slate-200 pt-6 space-y-4 max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CalendarOff className="size-4" />
            Отсутствие
          </h3>
          {!showAbsenceForm ? (
            <button
              type="button"
              onClick={() => setShowAbsenceForm(true)}
              className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              <Plus className="size-3.5" />
              Добавить
            </button>
          ) : null}
        </div>

        {loadingAbsences ? (
          <p className="text-sm text-slate-500">Загрузка…</p>
        ) : absences.length === 0 ? (
          <p className="text-sm text-slate-500">Нет запланированных периодов отсутствия.</p>
        ) : (
          <ul className="space-y-2">
            {absences.map((a) => (
              <li
                key={a.id}
                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                  a.isActive
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {absenceKindLabel(a.kind)}
                    {a.isActive ? (
                      <span className="ml-2 text-xs font-normal text-amber-700">сейчас</span>
                    ) : null}
                    {a.isUpcoming ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">скоро</span>
                    ) : null}
                  </p>
                  <p className="text-slate-600">{formatAbsenceRange(a.startDate, a.endDate)}</p>
                  {a.substitute ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Замещает: {a.substitute.name}
                    </p>
                  ) : null}
                  {a.note ? <p className="text-xs text-slate-500 mt-0.5">{a.note}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteAbsence(a.id)}
                  className="shrink-0 p-1 text-slate-400 hover:text-red-600"
                  title="Удалить"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAbsenceForm ? (
          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Тип</label>
              <select
                value={absenceKind}
                onChange={(e) => setAbsenceKind(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {ABSENCE_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">С</label>
                <input
                  type="date"
                  value={absenceStart}
                  onChange={(e) => setAbsenceStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">По</label>
                <input
                  type="date"
                  value={absenceEnd}
                  onChange={(e) => setAbsenceEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Замещающий (необязательно)
              </label>
              <select
                value={substituteUserId}
                onChange={(e) => setSubstituteUserId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— не указан —</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Комментарий</label>
              <input
                type="text"
                value={absenceNote}
                onChange={(e) => setAbsenceNote(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingAbsence || !absenceStart || !absenceEnd}
                onClick={() => void handleCreateAbsence()}
                className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {savingAbsence ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => setShowAbsenceForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <KeyRound className="size-4" />
          Безопасность
        </h3>
        <Link to="/change-password" className="text-sm text-brand hover:underline">
          Сменить пароль
        </Link>
      </section>
    </div>
  );
}
