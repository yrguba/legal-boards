-- AlterTable
ALTER TABLE "QuickCreateTaskPreset" ADD COLUMN "typeId" TEXT;
ALTER TABLE "QuickCreateTaskPreset" ADD COLUMN "legalFormsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuickCreateTaskPreset" ADD COLUMN "legalFormsPath" TEXT;
ALTER TABLE "QuickCreateTaskPreset" ADD COLUMN "legalFormsAccessTokenFieldId" TEXT;
