import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../store/AppContext';
import { Building2, Users, Shield, Bell, Handshake } from 'lucide-react';
import { usersApi } from '../services/api';

type SettingsTab = 'workspace' | 'users' | 'permissions' | 'notifications' | 'clients';

function formatLexClientDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function Settings() {
  const { currentWorkspace, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('workspace');

  const canManageClients =
    !!currentWorkspace &&
    (currentWorkspace.isOwner ||
      currentUser?.role === 'admin' ||
      currentUser?.role === 'manager');

  const [lexClients, setLexClients] = useState<
    Array<{
      id: string;
      email: string;
      name: string;
      clientKind?: string | null;
      companyName?: string | null;
      createdAt: string;
      workspaceLinkedAt?: string;
    }>
  >([]);
  const [lexClientsLoading, setLexClientsLoading] = useState(false);
  const [lexClientsError, setLexClientsError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'clients' || !currentWorkspace?.id || !canManageClients) return;
    let cancelled = false;
    setLexClientsLoading(true);
    setLexClientsError(null);
    usersApi
      .getLexClientsByWorkspace(currentWorkspace.id)
      .then((rows) => {
        if (!cancelled) setLexClients(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLexClientsError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
      })
      .finally(() => {
        if (!cancelled) setLexClientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentWorkspace?.id, canManageClients]);

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
            {canManageClients ? (
              <button
                onClick={() => setActiveTab('clients')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-colors ${
                  activeTab === 'clients'
                    ? 'bg-brand-light text-brand'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Handshake className="w-5 h-5" />
                <span>Клиенты LEXPRO</span>
              </button>
            ) : null}
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

          {activeTab === 'clients' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Клиенты LEXPRO</h2>
              <p className="text-sm text-slate-600 mb-4">
                Клиенты LEXPRO появляются здесь после того, как создали запрос на доске в этом рабочем
                пространстве (связь создаётся автоматически).
              </p>
              {!currentWorkspace?.id ? (
                <p className="text-sm text-slate-500">Выберите рабочее пространство в шапке приложения.</p>
              ) : lexClientsLoading ? (
                <p className="text-sm text-slate-500">Загрузка…</p>
              ) : lexClientsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {lexClientsError}
                </div>
              ) : lexClients.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Пока нет клиентов LEXPRO, связанных с этим пространством. После первого созданного ими
                  запроса на доске здесь появится запись.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-4 py-2 font-medium">Имя</th>
                        <th className="px-4 py-2 font-medium">Email</th>
                        <th className="px-4 py-2 font-medium">Тип</th>
                        <th className="px-4 py-2 font-medium">Компания</th>
                        <th className="px-4 py-2 font-medium">Регистрация в LEXPRO</th>
                        <th className="px-4 py-2 font-medium">Первый запрос в этом пространстве</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lexClients.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-900">{c.name}</td>
                          <td className="px-4 py-2 text-slate-700">{c.email}</td>
                          <td className="px-4 py-2 text-slate-700">
                            {c.clientKind === 'company' ? 'Компания' : 'Частное лицо'}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {c.clientKind === 'company' && c.companyName ? c.companyName : '—'}
                          </td>
                          <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                            {formatLexClientDate(c.createdAt)}
                          </td>
                          <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                            {c.workspaceLinkedAt ? formatLexClientDate(c.workspaceLinkedAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
              <div className="space-y-4">
                <label className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Новые задачи
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Уведомления при назначении новой задачи
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-brand" />
                </label>

                <label className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Комментарии
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Уведомления о новых комментариях к задачам
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-brand" />
                </label>

                <label className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Изменения статуса
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Уведомления об изменении статуса задачи
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-brand" />
                </label>

                <label className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Новые документы
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Уведомления о загрузке новых документов
                    </div>
                  </div>
                  <input type="checkbox" className="w-4 h-4 text-brand" />
                </label>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200">
                <button className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors">
                  Сохранить настройки
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
