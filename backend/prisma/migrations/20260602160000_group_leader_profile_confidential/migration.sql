-- Руководитель направления + конфиденциальность/маски полей профиля

ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "leaderId" TEXT;

ALTER TABLE "EmployeeProfileField" ADD COLUMN IF NOT EXISTS "confidential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmployeeProfileField" ADD COLUMN IF NOT EXISTS "mask" TEXT;

CREATE INDEX IF NOT EXISTS "Group_leaderId_idx" ON "Group"("leaderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Group_leaderId_fkey'
  ) THEN
    ALTER TABLE "Group" ADD CONSTRAINT "Group_leaderId_fkey"
      FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
