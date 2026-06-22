-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- CreateIndex
CREATE INDEX "PushDevice_userId_platform_idx" ON "PushDevice"("userId", "platform");

-- CreateIndex
CREATE INDEX "PushDevice_isActive_idx" ON "PushDevice"("isActive");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
