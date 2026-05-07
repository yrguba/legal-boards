/** Расширенные настройки доски (хранятся в Board.advancedSettings, JSON) */

export type AutoAssignTargetKind = 'department' | 'group' | 'user';

/** Режим назначения в рамках одного правила */
export type BoardAutoAssignAssignmentMode = 'on_load' | 'by_priority';

export type BoardAutoAssignRule = {
  id: string;
  taskTypeId: string;
  targetKind: AutoAssignTargetKind;
  targetId: string;
  assignmentMode: BoardAutoAssignAssignmentMode;
  /** При assignmentMode === by_priority — очередь пользователей (сверху выше приоритет), своё для каждого правила */
  priorityUserIds: string[];
};

export type BoardIframeService = {
  id: string;
  name: string;
  url: string;
  /** Дополнительные параметры для встраивания (например sandbox, query) */
  extraFields?: { key: string; value: string }[];
};

export type BoardAdvancedSettings = {
  autoAssignment?: {
    rules: BoardAutoAssignRule[];
  };
  /** Учёт времени по колонкам (статусам канбана): одна стартовая и одна финишная колонка */
  timeTracking?: {
    /** Колонка, при входе в которую начинается цикл учёта */
    startColumnId: string;
    /** Колонка, при входе в которую цикл завершается */
    stopColumnId: string;
    ignoreColumnIds: string[];
  };
  iframeServices?: BoardIframeService[];
};
