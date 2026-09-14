CREATE TABLE "SavedFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedFolder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedFolder_userId_name_key" ON "SavedFolder"("userId", "name");
ALTER TABLE "SavedFolder" ADD CONSTRAINT "SavedFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BucketListItem" ADD COLUMN "folderId" TEXT;
CREATE INDEX "BucketListItem_folderId_idx" ON "BucketListItem"("folderId");
ALTER TABLE "BucketListItem" ADD CONSTRAINT "BucketListItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SavedFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
