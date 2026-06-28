-- Для каждого отдела без направлений создаём направление с тем же названием
-- (восстанавливает структуру, когда «группы» совпадали с отделами).

INSERT INTO "Group" ("id", "name", "description", "workspaceId", "departmentId", "createdAt", "updatedAt")
SELECT
  'grp-sync-' || d."id",
  d."name",
  NULL,
  d."workspaceId",
  d."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Department" d
WHERE NOT EXISTS (
  SELECT 1 FROM "Group" g WHERE g."departmentId" = d."id"
);

-- Участники отдела → участники соответствующего направления
INSERT INTO "UserGroup" ("id", "userId", "groupId", "joinedAt")
SELECT
  'ug-sync-' || wu."userId" || '-' || g."id",
  wu."userId",
  g."id",
  CURRENT_TIMESTAMP
FROM "WorkspaceUser" wu
INNER JOIN "Group" g ON g."id" = 'grp-sync-' || wu."departmentId"
WHERE wu."departmentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserGroup" ug
    WHERE ug."userId" = wu."userId" AND ug."groupId" = g."id"
  );
