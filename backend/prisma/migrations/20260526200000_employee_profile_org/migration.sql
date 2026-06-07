-- Группы внутри отделов + настраиваемый профиль сотрудника

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileFields" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

INSERT INTO "Department" (id, name, description, "workspaceId", "createdAt", "updatedAt")
SELECT
  'dept-mig-' || g."workspaceId",
  'Общий отдел',
  'Создан автоматически при миграции групп',
  g."workspaceId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "workspaceId" FROM "Group" WHERE "departmentId" IS NULL) AS g
WHERE NOT EXISTS (
  SELECT 1 FROM "Department" d WHERE d."workspaceId" = g."workspaceId"
);

UPDATE "Group" AS grp
SET "departmentId" = sub.dept_id
FROM (
  SELECT g.id AS group_id,
    COALESCE(
      (SELECT d.id FROM "Department" d WHERE d."workspaceId" = g."workspaceId" ORDER BY d."createdAt" ASC LIMIT 1),
      'dept-mig-' || g."workspaceId"
    ) AS dept_id
  FROM "Group" g
  WHERE g."departmentId" IS NULL
) AS sub
WHERE grp.id = sub.group_id;

ALTER TABLE "Group" ALTER COLUMN "departmentId" SET NOT NULL;

ALTER TABLE "Group" ADD CONSTRAINT "Group_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Group_departmentId_idx" ON "Group"("departmentId");

CREATE TABLE IF NOT EXISTS "EmployeeProfileField" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "position" INTEGER NOT NULL,
    "section" TEXT,
    CONSTRAINT "EmployeeProfileField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeProfileField_workspaceId_key_key"
  ON "EmployeeProfileField"("workspaceId", "key");
CREATE INDEX IF NOT EXISTS "EmployeeProfileField_workspaceId_idx" ON "EmployeeProfileField"("workspaceId");
CREATE INDEX IF NOT EXISTS "EmployeeProfileField_position_idx" ON "EmployeeProfileField"("position");

ALTER TABLE "EmployeeProfileField" ADD CONSTRAINT "EmployeeProfileField_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
