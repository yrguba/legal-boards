import type { Document } from '../../../types';

export function getVisibilityLabel(doc: Document): string {
  const v = doc.visibility;
  if (!v?.type) return 'Всё пространство';
  switch (v.type) {
    case 'workspace':
      return 'Всё пространство';
    case 'department':
      return `Отделы (${v.departmentIds?.length || 0})`;
    case 'group':
      return `Группы (${v.groupIds?.length || 0})`;
    case 'custom':
      return `Участники (${v.userIds?.length || 0})`;
    default:
      return 'Не указано';
  }
}
