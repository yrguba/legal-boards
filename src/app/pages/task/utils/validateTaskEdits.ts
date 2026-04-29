import type { TaskField } from '../../../types';
import { isEmptyValue } from './customFieldValue';

/**
 * Заголовок и описание хранятся в Task как title/description и редактируются отдельно от customFields,
 * хотя на доске могут быть одноимённые поля «Название» / «Описание». При проверке обязательных полей
 * нужно опираться на editTitle / editDescription, а не на ключ в editCustomFields.
 */
export function validateTaskEdits(
  editTitle: string,
  editDescription: string,
  editColumnId: string,
  editTypeId: string,
  editCustomFields: Record<string, unknown>,
  taskFields: TaskField[],
  titleFieldId: string,
  descriptionFieldId: string,
): string | null {
  if (!editTitle.trim()) return 'Введите название задачи';
  if (!editColumnId) return 'Выберите статус';
  if (!editTypeId) return 'Выберите тип задачи';

  for (const f of taskFields) {
    if (!f.required) continue;

    if (titleFieldId && f.id === titleFieldId) {
      if (!editTitle.trim()) return `Заполните поле: ${f.name}`;
      continue;
    }

    if (descriptionFieldId && f.id === descriptionFieldId) {
      if (isEmptyValue(editDescription)) return `Заполните поле: ${f.name}`;
      continue;
    }

    if (isEmptyValue(editCustomFields[f.id])) return `Заполните поле: ${f.name}`;
  }
  return null;
}
