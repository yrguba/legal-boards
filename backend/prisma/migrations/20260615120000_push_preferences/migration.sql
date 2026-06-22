-- Per-user push notification preferences (same categories as in-app notification settings)
CREATE TABLE "PushPreference" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushPreference_pkey" PRIMARY KEY ("userId","key")
);

CREATE INDEX "PushPreference_userId_idx" ON "PushPreference"("userId");

ALTER TABLE "PushPreference" ADD CONSTRAINT "PushPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
