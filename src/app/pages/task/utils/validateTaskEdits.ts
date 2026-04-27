import type { TaskField } from '../../../types';
import { isEmptyValue } from './customFieldValue';

export function validateTaskEdits(
  editTitle: string,
  editColumnId: string,
  editTypeId: string,
  editCustomFields: Record<string, unknown>,
  taskFields: TaskField[],
): string | null {
  if (!editTitle.trim()) return 'Введите название задачи';
  if (!editColumnId) return 'Выберите статус';
  if (!editTypeId) return 'Выберите тип задачи';

  for (const f of taskFields) {
    if (!f.required) continue;
    if (isEmptyValue(editCustomFields[f.id])) return `Заполните поле: ${f.name}`;
  }
  return null;
}
