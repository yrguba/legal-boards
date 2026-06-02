-- Task.number (сквозная нумерация на доске) + BoardCodeAlias для redirect старых URL

CREATE TABLE "BoardCodeAlias" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardCodeAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardCodeAlias_code_key" ON "BoardCodeAlias"("code");
CREATE INDEX "BoardCodeAlias_boardId_idx" ON "BoardCodeAlias"("boardId");

ALTER TABLE "BoardCodeAlias" ADD CONSTRAINT "BoardCodeAlias_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN "number" INTEGER;

WITH numbered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY "boardId" ORDER BY "createdAt" ASC, id ASC) AS num
    FROM "Task"
)
UPDATE "Task" AS t
SET "number" = n.num
FROM numbered AS n
WHERE t.id = n.id;

ALTER TABLE "Task" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "Task_boardId_number_key" ON "Task"("boardId", "number");
