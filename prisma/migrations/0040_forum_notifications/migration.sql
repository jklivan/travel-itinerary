ALTER TABLE "Notification" ADD COLUMN "questionId" TEXT;
CREATE INDEX "Notification_questionId_idx" ON "Notification"("questionId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FriendQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
