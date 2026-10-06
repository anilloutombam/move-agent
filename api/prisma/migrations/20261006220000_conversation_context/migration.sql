-- AlterEnum
ALTER TYPE "MessageRole" ADD VALUE 'TOOL';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "requestId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_requestId_idx" ON "Conversation"("requestId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MoveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
