-- Порядок задач внутри колонки
ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Сохраняем текущий порядок: сверху — более новые (как при orderBy createdAt DESC)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "columnId" ORDER BY "createdAt" DESC) - 1 AS pos
  FROM "Task"
)
UPDATE "Task" t
SET "position" = ranked.pos
FROM ranked
WHERE t.id = ranked.id;

CREATE INDEX "Task_columnId_position_idx" ON "Task"("columnId", "position");
