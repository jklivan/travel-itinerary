-- Likes (the heart) are now separate from saves (BucketListItem). Starts empty; existing saves are unchanged.
CREATE TABLE "TripLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TripLike_userId_itineraryId_key" ON "TripLike"("userId", "itineraryId");
CREATE INDEX "TripLike_itineraryId_idx" ON "TripLike"("itineraryId");
ALTER TABLE "TripLike" ADD CONSTRAINT "TripLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripLike" ADD CONSTRAINT "TripLike_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
