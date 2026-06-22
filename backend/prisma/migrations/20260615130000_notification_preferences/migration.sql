-- Unified notification preferences (in-app + push)
ALTER TABLE "PushPreference" RENAME TO "NotificationPreference";
ALTER INDEX "PushPreference_pkey" RENAME TO "NotificationPreference_pkey";
ALTER INDEX "PushPreference_userId_idx" RENAME TO "NotificationPreference_userId_idx";
ALTER TABLE "NotificationPreference" RENAME CONSTRAINT "PushPreference_userId_fkey" TO "NotificationPreference_userId_fkey";
