import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { Building2, Users, Shield, Bell } from 'lucide-react';

type SettingsTab = 'workspace' | 'users' | 'permissions' | 'notifications';

export function Settings() {
  const { currentWorkspace, currentUser } = useApp();
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
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Рабочее пространство
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    defaultValue={currentWorkspace?.name}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    defaultValue={currentWorkspace?.description}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                </div>
                <div className="pt-4">
                  <button className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors">
                    Сохранить изменения
                  </button>
                </div>
              </div>
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
