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

export type BoardApprovalRule = {
  id: string;
  name: string;
  columnId: string;
  approverUserId: string;
  substituteUserIds: string[];
};

export type ColumnActionTrigger = 'on_enter' | 'on_exit';
export type ColumnActionKind = 'confirm' | 'form' | 'check_task';

export type ColumnActionFormField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'checkbox';
  required?: boolean;
  options?: string[];
};

export type ColumnActionCheckItem = {
  type:
    | 'assignee_set'
    | 'description_set'
    | 'custom_field_set'
    | 'attachment_present'
    | 'conclusion_set';
  fieldId?: string;
  label?: string;
};

export type BoardColumnActionRule = {
  id: string;
  name: string;
  columnId: string;
  trigger: ColumnActionTrigger;
  blocking: boolean;
  actionKind: ColumnActionKind;
  config: {
    message?: string;
    requireCheckbox?: boolean;
    checkboxLabel?: string;
    fields?: ColumnActionFormField[];
    checks?: ColumnActionCheckItem[];
  };
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
  /** Обязательные согласования при нахождении задачи в колонке */
  approvals?: {
    rules: BoardApprovalRule[];
  };
  /** Обязательные действия при входе/выходе из колонки */
  columnActions?: {
    rules: BoardColumnActionRule[];
  };
  /** Учёт времени по колонкам (статусам канбана): одна стартовая и одна финишная колонка */
  timeTracking?: {
    /** Колонка, при входе в которую начинается цикл учёта */
    startColumnId: string;
    /** Колонка, при входе в которую цикл завершается */
    stopColumnId: string;
    ignoreColumnIds: string[];
  };
  /** Настройки отчётности и SLA */
  reporting?: {
    /** Колонка «Готово» для lead/cycle time (по умолчанию — stopColumnId учёта времени) */
    doneColumnId: string;
  };
  iframeServices?: BoardIframeService[];
};
