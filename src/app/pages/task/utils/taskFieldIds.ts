import type { TaskField } from '../../../types';

export function getSortedTaskFields(taskFields: TaskField[] | undefined): TaskField[] {
  return [...(taskFields || [])].sort((a, b) => a.position - b.position);
}

export function getTitleFieldId(taskFields: TaskField[]): string {
  const byName = taskFields.find(
    (f) => f.type === 'text' && String(f.name || '').trim().toLowerCase() === 'название',
  );
  if (byName) return byName.id;
  const requiredText = taskFields.find((f) => f.type === 'text' && f.required);
  return requiredText?.id || '';
}

export function getDescriptionFieldId(taskFields: TaskField[]): string {
  const byName = taskFields.find(
    (f) =>
      (f.type === 'textarea' || f.type === 'text') &&
      String(f.name || '').trim().toLowerCase() === 'описание',
  );
  return byName?.id || '';
}
