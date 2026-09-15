CREATE TABLE "SavedImportNotes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "text" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SavedImportNotes_userId_digest_key" ON "SavedImportNotes"("userId", "digest");
CREATE INDEX "SavedImportNotes_userId_createdAt_idx" ON "SavedImportNotes"("userId", "createdAt");
