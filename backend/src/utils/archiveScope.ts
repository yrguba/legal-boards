/** Фильтр активных (не архивных) записей для Prisma where. */
export const NOT_ARCHIVED = { archivedAt: null } as const;

/** Только архивные записи. */
export const ARCHIVED_ONLY = { archivedAt: { not: null } } as const;

export function isArchived(record: { archivedAt: Date | null | undefined }): boolean {
  return record.archivedAt != null;
}
