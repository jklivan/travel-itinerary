-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "replyToId" TEXT;

-- CreateTable
CREATE TABLE "FriendQuestion" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "clientId" TEXT NOT NULL,
    "itineraryId" TEXT,
    "itineraryTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendQuestionReply" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "clientId" TEXT NOT NULL,
    "itineraryId" TEXT,
    "itineraryTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendQuestionReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendQuestion_authorId_createdAt_id_idx" ON "FriendQuestion"("authorId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FriendQuestion_authorId_clientId_key" ON "FriendQuestion"("authorId", "clientId");

-- CreateIndex
CREATE INDEX "FriendQuestionReply_questionId_createdAt_id_idx" ON "FriendQuestionReply"("questionId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FriendQuestionReply_authorId_clientId_key" ON "FriendQuestionReply"("authorId", "clientId");

-- CreateIndex
CREATE INDEX "DirectMessage_replyToId_idx" ON "DirectMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendQuestion" ADD CONSTRAINT "FriendQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendQuestionReply" ADD CONSTRAINT "FriendQuestionReply_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FriendQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendQuestionReply" ADD CONSTRAINT "FriendQuestionReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
