-- Конвертация русских значений приоритета в английские ключи (если миграция уже применена с русскими)
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'medium';

UPDATE "Task"
SET "priority" = CASE "priority"
  WHEN 'Незначительный' THEN 'trivial'
  WHEN 'Низкий' THEN 'low'
  WHEN 'Средний' THEN 'medium'
  WHEN 'Высокий' THEN 'high'
  WHEN 'Критичный' THEN 'critical'
  WHEN 'Критический' THEN 'critical'
  ELSE "priority"
END
WHERE "priority" IN ('Незначительный', 'Низкий', 'Средний', 'Высокий', 'Критичный', 'Критический');
