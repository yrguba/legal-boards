ALTER TABLE "User" ADD COLUMN "passwordInviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordInviteExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_passwordInviteToken_key" ON "User"("passwordInviteToken");
