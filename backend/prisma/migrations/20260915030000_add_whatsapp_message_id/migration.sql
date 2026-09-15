ALTER TABLE "MessageLog" ADD COLUMN "whatsappMessageId" TEXT;
CREATE UNIQUE INDEX "MessageLog_whatsappMessageId_key" ON "MessageLog"("whatsappMessageId");