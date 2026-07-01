-- QuickCreateTaskPreset: статичный LF access_token вместо ссылки на поле задачи
ALTER TABLE "QuickCreateTaskPreset" ADD COLUMN "legalFormsAccessToken" TEXT;
ALTER TABLE "QuickCreateTaskPreset" DROP COLUMN IF EXISTS "legalFormsAccessTokenFieldId";
