ALTER TABLE "Notification" ALTER COLUMN "itineraryId" DROP NOT NULL;
ALTER TABLE "Notification" ADD COLUMN "messageId" TEXT;
CREATE UNIQUE INDEX "Notification_messageId_key" ON "Notification"("messageId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Include existing messages in activity history without treating them as newly unread.
INSERT INTO "Notification" ("id", "recipientId", "actorId", "kind", "dedupeKey", "messageId", "readAt", "createdAt")
SELECT 'message:' || "id", "recipientId", "senderId", 'message', 'message:' || "id", "id", "createdAt", "createdAt"
FROM "DirectMessage"
ON CONFLICT DO NOTHING;
