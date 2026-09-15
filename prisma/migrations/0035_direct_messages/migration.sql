CREATE TABLE "DirectMessage" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "content" VARCHAR(4000) NOT NULL,
  "clientId" TEXT NOT NULL,
  "itineraryId" TEXT,
  "itineraryTitle" TEXT,
  "placeId" TEXT,
  "placeName" TEXT,
  "placeNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DirectMessage_senderId_clientId_key" ON "DirectMessage"("senderId", "clientId");
CREATE INDEX "DirectMessage_senderId_recipientId_createdAt_idx" ON "DirectMessage"("senderId", "recipientId", "createdAt");
CREATE INDEX "DirectMessage_recipientId_createdAt_idx" ON "DirectMessage"("recipientId", "createdAt");
