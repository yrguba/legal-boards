ALTER TABLE "Board" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'standard';

CREATE TABLE "AggregatedBoardSource" (
    "id" TEXT NOT NULL,
    "aggregatedBoardId" TEXT NOT NULL,
    "sourceBoardId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AggregatedBoardSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AggregatedBoardSource_aggregatedBoardId_sourceBoardId_key" ON "AggregatedBoardSource"("aggregatedBoardId", "sourceBoardId");
CREATE INDEX "AggregatedBoardSource_aggregatedBoardId_idx" ON "AggregatedBoardSource"("aggregatedBoardId");
CREATE INDEX "AggregatedBoardSource_sourceBoardId_idx" ON "AggregatedBoardSource"("sourceBoardId");
CREATE INDEX "Board_kind_idx" ON "Board"("kind");

ALTER TABLE "AggregatedBoardSource" ADD CONSTRAINT "AggregatedBoardSource_aggregatedBoardId_fkey" FOREIGN KEY ("aggregatedBoardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AggregatedBoardSource" ADD CONSTRAINT "AggregatedBoardSource_sourceBoardId_fkey" FOREIGN KEY ("sourceBoardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
