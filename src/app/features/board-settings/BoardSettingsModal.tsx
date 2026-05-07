import { useEffect, useState } from 'react';
import { Timer, UserCog, Puzzle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { cn } from '../../components/ui/utils';
import type { Board } from '../../types';
import { boardsApi, departmentsApi, groupsApi } from '../../services/api';
import type { User } from '../../types';
import { mergeBoardAdvanced, defaultBoardAdvancedSettings } from './boardAdvancedSettings.defaults';
import type { BoardAdvancedSettings } from './boardAdvancedSettings.types';
import { AutoAssignmentSection } from './sections/AutoAssignmentSection';
import { TimeTrackingSection } from './sections/TimeTrackingSection';
import { IframeServicesSection } from './sections/IframeServicesSection';

type DeptLite = { id: string; name: string };
type GroupLite = { id: string; name: string };

type SettingsTab = 'assignment' | 'time' | 'services';

const tabTriggerClass =
  'rounded-md px-3 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-brand data-[state=active]:shadow-sm';

export function BoardSettingsModal({
  open,
  onClose,
  board,
  users,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  board: Board;
  users: User[];
  onSaved: (board: Board) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('assignment');
  const [draft, setDraft] = useState<BoardAdvancedSettings>(() =>
    mergeBoardAdvanced(board.advancedSettings ?? {}),
  );
  const [departments, setDepartments] = useState<DeptLite[]>([]);
  const [groups, setGroups] = useState<GroupLite[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(mergeBoardAdvanced(board.advancedSettings ?? {}));
    setError(null);
    setActiveTab('assignment');
  }, [open, board.id, board.advancedSettings]);

  useEffect(() => {
    if (!open || !board.workspaceId) return;
    let cancelled = false;
    setLoadingRefs(true);
    Promise.all([
      departmentsApi.getByWorkspace(board.workspaceId),
      groupsApi.getByWorkspace(board.workspaceId),
    ])
      .then(([d, g]) => {
        if (cancelled) return;
        setDepartments((d || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
        setGroups((g || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      })
      .catch(() => {
        if (!cancelled) {
          setDepartments([]);
          setGroups([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, board.workspaceId]);

  const aa = draft.autoAssignment ?? defaultBoardAdvancedSettings().autoAssignment!;
  const tt = draft.timeTracking ?? defaultBoardAdvancedSettings().timeTracking!;
  const iframeList = draft.iframeServices ?? [];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await boardsApi.patchAdvancedSettings(board.id, draft);
      onSaved(updated as Board);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
          <DialogTitle>Настройки доски</DialogTitle>
          <DialogDescription className="text-left">
            {board.name} — разделы ниже. Доступно только ролям администратора и руководителя.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 border-b border-slate-100 px-6 pt-3 pb-0">
            <TabsList
              className={cn(
                'inline-flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg bg-slate-100 p-1 sm:flex-nowrap',
              )}
            >
              <TabsTrigger value="assignment" className={cn(tabTriggerClass, 'inline-flex items-center gap-1.5')}>
                <UserCog className="size-4 shrink-0 opacity-70" aria-hidden />
                Автоназначение
              </TabsTrigger>
              <TabsTrigger value="time" className={cn(tabTriggerClass, 'inline-flex items-center gap-1.5')}>
                <Timer className="size-4 shrink-0 opacity-70" aria-hidden />
                Контроль времени
              </TabsTrigger>
              <TabsTrigger value="services" className={cn(tabTriggerClass, 'inline-flex items-center gap-1.5')}>
                <Puzzle className="size-4 shrink-0 opacity-70" aria-hidden />
                Сервисы
              </TabsTrigger>
            </TabsList>
            {loadingRefs ? (
              <p className="py-2 text-xs text-slate-500">Загрузка отделов и групп для вкладки «Автоназначение»…</p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {error ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <TabsContent value="assignment" className="mt-0 focus-visible:outline-none">
              <AutoAssignmentSection
                autoAssignment={aa}
                taskTypes={board.taskTypes ?? []}
                departments={departments}
                groups={groups}
                users={users.map((u) => ({ id: u.id, name: u.name }))}
                onChange={(next) => setDraft((d) => ({ ...d, autoAssignment: next }))}
              />
            </TabsContent>

            <TabsContent value="time" className="mt-0 focus-visible:outline-none">
              <TimeTrackingSection
                timeTracking={tt}
                columns={(board.columns ?? []).map((c) => ({ id: c.id, name: c.name }))}
                onChange={(next) => setDraft((d) => ({ ...d, timeTracking: next }))}
              />
            </TabsContent>

            <TabsContent value="services" className="mt-0 focus-visible:outline-none">
              <IframeServicesSection
                services={iframeList}
                onChange={(next) => setDraft((d) => ({ ...d, iframeServices: next }))}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
