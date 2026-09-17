ALTER TABLE "Notification" ADD COLUMN "questionReplyId" TEXT;
CREATE UNIQUE INDEX "Notification_questionReplyId_key" ON "Notification"("questionReplyId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_questionReplyId_fkey" FOREIGN KEY ("questionReplyId") REFERENCES "FriendQuestionReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
