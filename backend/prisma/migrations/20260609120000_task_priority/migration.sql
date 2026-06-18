-- Системное поле приоритета задачи (ключи на английском)
ALTER TABLE "Task" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';

-- Backfill из кастомного поля «Приоритет» на доске
UPDATE "Task" t
SET "priority" = CASE
  WHEN sub.raw IN ('Критический', 'Критичный', 'critical', 'Critical') THEN 'critical'
  WHEN sub.raw IN ('Незначительный', 'trivial', 'Trivial') THEN 'trivial'
  WHEN sub.raw IN ('Низкий', 'low', 'Low') THEN 'low'
  WHEN sub.raw IN ('Средний', 'medium', 'Medium') THEN 'medium'
  WHEN sub.raw IN ('Высокий', 'high', 'High') THEN 'high'
  ELSE 'medium'
END
FROM (
  SELECT
    t2.id AS task_id,
    TRIM(BOTH '"' FROM (t2."customFields"->>tf.id)) AS raw
  FROM "Task" t2
  INNER JOIN "TaskField" tf
    ON tf."boardId" = t2."boardId"
    AND LOWER(TRIM(tf.name)) = 'приоритет'
  WHERE t2."customFields" ? tf.id
    AND (t2."customFields"->>tf.id) IS NOT NULL
    AND TRIM(BOTH '"' FROM (t2."customFields"->>tf.id)) <> ''
) sub
WHERE t.id = sub.task_id;

-- Удалить приоритет из customFields
UPDATE "Task" t
SET "customFields" = t."customFields" - tf.id
FROM "TaskField" tf
WHERE tf."boardId" = t."boardId"
  AND LOWER(TRIM(tf.name)) = 'приоритет'
  AND t."customFields" ? tf.id;

-- Удалить кастомное поле «Приоритет» с досок
DELETE FROM "TaskField" WHERE LOWER(TRIM(name)) = 'приоритет';
