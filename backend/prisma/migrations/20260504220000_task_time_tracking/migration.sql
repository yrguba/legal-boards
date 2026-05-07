-- AlterTable
ALTER TABLE "Task" ADD COLUMN "trackedTimeSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "timeTrackingActiveSince" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "timeTrackingCycleOpen" BOOLEAN NOT NULL DEFAULT false;
