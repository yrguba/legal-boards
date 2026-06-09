import type { TaskField } from '../../../types';
import { isEmptyValue } from './customFieldValue';

export type InlineFieldKey =
  | 'title'
  | 'description'
  | 'columnId'
  | 'typeId'
  | 'assigneeId'
  | `custom:${string}`;

export function validateField(
  key: InlineFieldKey,
  value: unknown,
  taskFields: TaskField[],
  titleFieldId: string,
  descriptionFieldId: string,
): string | null {
  if (key === 'title') {
    if (typeof value !== 'string' || !value.trim()) return 'Введите название задачи';
    const titleField = taskFields.find((f) => f.id === titleFieldId);
    if (titleField?.required && !value.trim()) return `Заполните поле: ${titleField.name}`;
    return null;
  }

  if (key === 'description') {
    const descField = taskFields.find((f) => f.id === descriptionFieldId);
    if (descField?.required && isEmptyValue(value)) return `Заполните поле: ${descField.name}`;
    return null;
  }

  if (key === 'columnId') {
    if (typeof value !== 'string' || !value) return 'Выберите статус';
    return null;
  }

  if (key === 'typeId') {
    if (typeof value !== 'string' || !value) return 'Выберите тип задачи';
    return null;
  }

  if (key.startsWith('custom:')) {
    const fieldId = key.slice('custom:'.length);
    const field = taskFields.find((f) => f.id === fieldId);
    if (field?.required && isEmptyValue(value)) return `Заполните поле: ${field.name}`;
    return null;
  }

  return null;
}
