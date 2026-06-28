-- Группы снова могут существовать отдельно от отделов (departmentId = NULL).
-- Направления / продукты по-прежнему привязаны к отделу (departmentId NOT NULL).

ALTER TABLE "Group" ALTER COLUMN "departmentId" DROP NOT NULL;
