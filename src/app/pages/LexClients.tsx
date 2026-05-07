import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { FileSearch } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { usersApi } from '../services/api';
import { CLIENT_INTERACTION_KINDS } from './task/constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

function formatDateTime(iso: string) {
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

type DirectoryIx = Awaited<
  ReturnType<typeof usersApi.getLexClientsDirectory>
>['clients'][number]['interactions'][number];

type DirectoryClient = Awaited<
  ReturnType<typeof usersApi.getLexClientsDirectory>
>['clients'][number];

function clientHeading(c: DirectoryClient) {
  return c.clientKind === 'company' && c.companyName ? c.companyName : c.name;
}

function kindLabel(kind: string) {
  return CLIENT_INTERACTION_KINDS.find((k) => k.value === kind)?.label || kind;
}

export function LexClients() {
  const { currentWorkspace, currentUser } = useApp();
  const canManage =
    !!currentWorkspace &&
    (currentWorkspace.isOwner || currentUser?.role === 'admin' || currentUser?.role === 'manager');

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [minTasks, setMinTasks] = useState('');
  const [maxTasks, setMaxTasks] = useState('');
  const [typeId, setTypeId] = useState('');
  const [taskCountSortOrder, setTaskCountSortOrder] = useState<'asc' | 'desc'>('desc');

  const [data, setData] = useState<Awaited<ReturnType<typeof usersApi.getLexClientsDirectory>> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailIx, setDetailIx] = useState<
    (DirectoryIx & { clientLabel: string; clientEmail: string }) | null
  >(null);
  const [requestHistoryClient, setRequestHistoryClient] = useState<DirectoryClient | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    if (!canManage || !currentWorkspace?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    usersApi
      .getLexClientsDirectory(currentWorkspace.id, {
        q: q || undefined,
        minTasks: minTasks.trim() !== '' ? minTasks : undefined,
        maxTasks: maxTasks.trim() !== '' ? maxTasks : undefined,
        typeId: typeId || undefined,
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, currentWorkspace?.id, q, minTasks, maxTasks, typeId]);

  const interactionsFlat = useMemo(() => {
    if (!data?.clients.length) return [];
    const rows: (DirectoryIx & { clientLabel: string; clientEmail: string })[] = [];
    for (const c of data.clients) {
      const clientLabel =
        c.clientKind === 'company' && c.companyName ? c.companyName : c.name;
      for (const ix of c.interactions) {
        rows.push({ ...ix, clientLabel, clientEmail: c.email });
      }
    }
    rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return rows;
  }, [data]);

  const sortedClients = useMemo(() => {
    if (!data?.clients?.length) return [];
    const list = [...data.clients];
    list.sort((a, b) =>
      taskCountSortOrder === 'asc' ? a.taskCount - b.taskCount : b.taskCount - a.taskCount,
    );
    return list;
  }, [data, taskCountSortOrder]);

  const sortedRequestTasks = useMemo(() => {
    if (!requestHistoryClient?.tasks.length) return [];
    return [...requestHistoryClient.tasks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [requestHistoryClient]);

  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Клиенты LEXPRO</h1>
        <p className="mt-3 text-sm text-slate-600">
          Раздел доступен владельцу пространства, администраторам и менеджерам.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Клиенты LEXPRO</h1>
        <p className="mt-1 text-sm text-slate-600">
          Клиенты появляются после создания запроса на доске этого рабочего пространства. Здесь видны запросы
          и зарегистрированные взаимодействия.
        </p>
      </div>

      {!currentWorkspace?.id ? (
        <p className="text-sm text-slate-500">Выберите рабочее пространство в шапке приложения.</p>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Компания или имя
              </label>
              <div className="relative">
                <FileSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Поиск…"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            <div className="w-full sm:w-[120px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">Запросов от</label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={minTasks}
                onChange={(e) => setMinTasks(e.target.value)}
                placeholder="—"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="w-full sm:w-[120px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">Запросов до</label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={maxTasks}
                onChange={(e) => setMaxTasks(e.target.value)}
                placeholder="—"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Услуга (тип задачи)</label>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Все</option>
                {(data?.serviceTypes ?? []).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && !data ? (
            <p className="text-sm text-slate-500">Загрузка…</p>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-slate-800">
                    Клиенты
                    {loading ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">обновление…</span>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="shrink-0">Сортировка по числу запросов:</span>
                    <select
                      value={taskCountSortOrder}
                      onChange={(e) =>
                        setTaskCountSortOrder(e.target.value === 'asc' ? 'asc' : 'desc')
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="desc">По убыванию</option>
                      <option value="asc">По возрастанию</option>
                    </select>
                  </label>
                </div>
                {!data?.clients.length ? (
                  <p className="p-4 text-sm text-slate-500">Нет записей по выбранным фильтрам.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-4 py-2 font-medium">Имя / компания</th>
                          <th className="px-4 py-2 font-medium">Email</th>
                          <th className="px-4 py-2 font-medium">Тип</th>
                          <th className="px-4 py-2 font-medium">Запросов</th>
                          <th className="px-4 py-2 font-medium">Связь с пространством</th>
                          <th className="whitespace-nowrap px-4 py-2 font-medium">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedClients.map((c) => (
                          <tr key={c.id} className="border-t border-slate-100">
                            <td className="px-4 py-2 text-slate-900">
                              {c.clientKind === 'company' && c.companyName ? (
                                <>
                                  <div className="font-medium">{c.companyName}</div>
                                  <div className="text-xs text-slate-500">{c.name}</div>
                                </>
                              ) : (
                                c.name
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-700">{c.email}</td>
                            <td className="px-4 py-2 text-slate-700">
                              {c.clientKind === 'company' ? 'Компания' : 'Частное лицо'}
                            </td>
                            <td className="px-4 py-2 text-slate-900 tabular-nums">{c.taskCount}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                              {formatDateTime(c.workspaceLinkedAt)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setRequestHistoryClient(c)}
                                className="text-sm font-medium text-brand hover:text-brand-hover"
                              >
                                История запросов
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800">
                  Взаимодействия
                </div>
                {!interactionsFlat.length ? (
                  <p className="p-4 text-sm text-slate-500">
                    Взаимодействия добавляются в карточке задачи («Клиент»). Для этих клиентов записей пока
                    нет.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-4 py-2 font-medium">Когда</th>
                          <th className="px-4 py-2 font-medium">Клиент</th>
                          <th className="px-4 py-2 font-medium">Вид</th>
                          <th className="px-4 py-2 font-medium">Тема</th>
                          <th className="px-4 py-2 font-medium">Услуга</th>
                          <th className="px-4 py-2 font-medium">Сотрудник</th>
                          <th className="px-4 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {interactionsFlat.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                              {formatDateTime(row.occurredAt)}
                            </td>
                            <td className="px-4 py-2 text-slate-900">{row.clientLabel}</td>
                            <td className="px-4 py-2 text-slate-700">{kindLabel(row.kind)}</td>
                            <td className="max-w-[200px] truncate px-4 py-2 text-slate-800" title={row.title}>
                              {row.title}
                            </td>
                            <td className="px-4 py-2 text-slate-600">{row.taskTypeName}</td>
                            <td className="px-4 py-2 text-slate-700">{row.user?.name || '—'}</td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => setDetailIx(row)}
                                className="text-sm font-medium text-brand hover:text-brand-hover"
                              >
                                Подробнее
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={detailIx !== null} onOpenChange={(o) => !o && setDetailIx(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-200 sm:max-w-lg">
          {detailIx ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900">Взаимодействие</DialogTitle>
              </DialogHeader>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Клиент</dt>
                  <dd className="text-slate-900">{detailIx.clientLabel}</dd>
                  <dd className="text-xs text-slate-500">{detailIx.clientEmail}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Вид</dt>
                  <dd className="text-slate-900">{kindLabel(detailIx.kind)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Тема</dt>
                  <dd className="whitespace-pre-wrap text-slate-900">{detailIx.title}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Подробности</dt>
                  <dd className="whitespace-pre-wrap text-slate-800">
                    {detailIx.details?.trim()
                      ? detailIx.details
                      : 'Не указано'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Дата события</dt>
                  <dd className="text-slate-900">{formatDateTime(detailIx.occurredAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Запись создана</dt>
                  <dd className="text-slate-600">{formatDateTime(detailIx.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Услуга (тип)</dt>
                  <dd className="text-slate-900">{detailIx.taskTypeName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Запрос (задача)</dt>
                  <dd className="text-slate-900">{detailIx.taskTitle}</dd>
                  <dd className="mt-1 text-slate-500">
                    {detailIx.boardName}
                    {' · '}
                    <Link
                      to={`/task/${detailIx.taskId}`}
                      className="font-medium text-brand hover:text-brand-hover"
                    >
                      Открыть карточку
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Ответственный сотрудник</dt>
                  <dd className="text-slate-900">{detailIx.user?.name || '—'}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={requestHistoryClient !== null}
        onOpenChange={(o) => {
          if (!o) setRequestHistoryClient(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-200 sm:max-w-2xl">
          {requestHistoryClient ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900">История запросов</DialogTitle>
                <p className="text-sm text-slate-600">
                  {clientHeading(requestHistoryClient)}
                  <span className="text-slate-400"> · </span>
                  {requestHistoryClient.email}
                </p>
              </DialogHeader>
              {!sortedRequestTasks.length ? (
                <p className="text-sm text-slate-500">У этого клиента пока нет запросов в этом пространстве.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">Создан</th>
                        <th className="px-3 py-2 font-medium">Запрос</th>
                        <th className="px-3 py-2 font-medium">Доска</th>
                        <th className="px-3 py-2 font-medium">Услуга</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRequestTasks.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                            {formatDateTime(t.createdAt)}
                          </td>
                          <td className="max-w-[220px] px-3 py-2 font-medium text-slate-900" title={t.title}>
                            <span className="line-clamp-2">{t.title}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{t.boardName}</td>
                          <td className="px-3 py-2 text-slate-600">{t.typeName}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <Link
                              to={`/task/${t.id}`}
                              className="font-medium text-brand hover:text-brand-hover"
                            >
                              Открыть
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
