-- "Send trips to Postcard": each person's private inbox address and the extra addresses allowed to send to it.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inboxSenders" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inboxToken" VARCHAR(40);

-- CreateIndex
CREATE UNIQUE INDEX "User_inboxToken_key" ON "User"("inboxToken");

