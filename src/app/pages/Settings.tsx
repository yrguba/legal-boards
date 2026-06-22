import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../store/AppContext';
import { Building2, Users, Shield, Bell } from 'lucide-react';
import { ApiError, notificationsApi, type NotificationSettingItem } from '../services/api';

type SettingsTab = 'workspace' | 'users' | 'permissions' | 'notifications';

function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotificationSettingItem[]>([]);
  const [groups, setGroups] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    notificationsApi
      .getSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setGroups(data.groups);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить настройки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      items: settings.filter((s) => s.group === group.id),
    }));
  }, [groups, settings]);

  const toggle = (key: string, enabled: boolean) => {
    setSaved(false);
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const patch = Object.fromEntries(settings.map((s) => [s.key, s.enabled]));
      const data = await notificationsApi.updateSettings(patch);
      setSettings(data.settings);
      setGroups(data.groups);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Загрузка настроек…</p>;
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Настройки применяются к in-app уведомлениям и push в мобильном приложении.
      </p>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Настройки сохранены
        </div>
      ) : null}

      <div className="space-y-6">
        {grouped.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.id}>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">{group.label}</h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between py-3 border-b border-slate-200 last:border-b-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => toggle(item.key, e.target.checked)}
                      className="w-4 h-4 text-brand"
                    />
                  </label>
                ))}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="pt-6 mt-6 border-t border-slate-200">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}

export function Settings() {
  const { currentWorkspace } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('workspace');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Настройки</h1>
        <p className="text-sm text-slate-600 mt-1">
          Управление рабочим пространством и настройками
        </p>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-colors ${
                activeTab === 'workspace'
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span>Рабочее пространство</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-colors ${
                activeTab === 'users'
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Пользователи и роли</span>
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-colors ${
                activeTab === 'permissions'
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Права доступа</span>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-5 h-5" />
              <span>Уведомления</span>
            </button>
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'workspace' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Рабочее пространство</h2>
              <p className="text-sm text-slate-600 mb-4">
                Сейчас выбрано:{' '}
                <span className="font-medium text-slate-900">{currentWorkspace?.name || '—'}</span>
                {currentWorkspace?.description ? (
                  <span className="block mt-2 text-slate-600">{currentWorkspace.description}</span>
                ) : null}
              </p>
              <p className="text-sm text-slate-600 mb-4">
                Создание новых пространств, переименование и удаление доступны на отдельной странице.
              </p>
              <Link
                to="/workspaces"
                className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded hover:bg-brand-hover transition-colors"
              >
                Открыть «Пространства»
              </Link>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Роли пользователей
              </h2>
              <div className="space-y-4">
                <div className="border border-slate-200 rounded p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Администратор</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Полный доступ ко всем функциям, включая создание рабочих пространств и
                    управление пользователями
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-5 list-disc">
                    <li>Создание и удаление рабочих пространств</li>
                    <li>Управление пользователями и ролями</li>
                    <li>Настройка досок и задач</li>
                    <li>Доступ ко всем документам</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Менеджер</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Управление задачами, документами и участниками команды
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-5 list-disc">
                    <li>Создание и управление досками</li>
                    <li>Назначение задач</li>
                    <li>Загрузка и управление документами</li>
                    <li>Просмотр отчетов</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Сотрудник</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Работа с назначенными задачами и документами
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-5 list-disc">
                    <li>Просмотр и редактирование своих задач</li>
                    <li>Доступ к разрешенным документам</li>
                    <li>Комментирование и обновление статусов</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Гость</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Ограниченный доступ только для просмотра
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-5 list-disc">
                    <li>Просмотр назначенных задач</li>
                    <li>Чтение разрешенных документов</li>
                    <li>Базовое взаимодействие</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Права доступа</h2>
              <p className="text-sm text-slate-600 mb-6">
                Настройка прав доступа к документам и доскам на уровне отделов и групп
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Видимость по умолчанию
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Уровень доступа для новых документов и досок
                    </div>
                  </div>
                  <select className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option>Всё пространство</option>
                    <option>Только отдел</option>
                    <option>Только группа</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Разрешить создание досок
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Кто может создавать новые рабочие доски
                    </div>
                  </div>
                  <select className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option>Только администраторы</option>
                    <option>Администраторы и менеджеры</option>
                    <option>Все пользователи</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Загрузка документов
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Кто может загружать документы в хранилище
                    </div>
                  </div>
                  <select className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option>Только администраторы</option>
                    <option>Администраторы и менеджеры</option>
                    <option>Все пользователи</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200">
                <button className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors">
                  Сохранить настройки
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Уведомления</h2>
              <NotificationSettingsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
