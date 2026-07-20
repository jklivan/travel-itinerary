CREATE TABLE "BucketListItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itineraryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BucketListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BucketListItem_userId_itineraryId_key"
  ON "BucketListItem"("userId", "itineraryId");

ALTER TABLE "BucketListItem"
  ADD CONSTRAINT "BucketListItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BucketListItem"
  ADD CONSTRAINT "BucketListItem_itineraryId_fkey"
  FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
