-- Перенос отдела с глобального User.departmentId на WorkspaceUser.departmentId
-- и удаление устаревшего поля.

-- 1) Дозаполнить отдел у существующих участников пространства
UPDATE "WorkspaceUser" wu
SET "departmentId" = u."departmentId"
FROM "User" u
INNER JOIN "Department" d ON d."id" = u."departmentId"
WHERE wu."userId" = u."id"
  AND wu."departmentId" IS NULL
  AND u."departmentId" IS NOT NULL
  AND d."workspaceId" = wu."workspaceId";

-- 2) Владельцы без строки WorkspaceUser, но с отделом в своём пространстве
INSERT INTO "WorkspaceUser" ("id", "workspaceId", "userId", "role", "departmentId", "profileFields", "joinedAt")
SELECT
  'mig_' || w."id" || '_' || w."ownerId",
  w."id",
  w."ownerId",
  'admin',
  u."departmentId",
  COALESCE(u."profileFields", '{}'::jsonb),
  CURRENT_TIMESTAMP
FROM "Workspace" w
INNER JOIN "User" u ON u."id" = w."ownerId"
INNER JOIN "Department" d ON d."id" = u."departmentId" AND d."workspaceId" = w."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "WorkspaceUser" wu
  WHERE wu."workspaceId" = w."id" AND wu."userId" = w."ownerId"
);

-- 3) Удалить глобальное поле User.departmentId
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_departmentId_fkey";
DROP INDEX IF EXISTS "User_departmentId_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "departmentId";
