CREATE TABLE "Story" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sourceItineraryId" TEXT REFERENCES "Itinerary"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "sourceItemId" TEXT REFERENCES "DestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "placeName" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "country" TEXT,
  "type" TEXT NOT NULL,
  "placeId" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "photoUrl" TEXT NOT NULL,
  "caption" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");
CREATE INDEX "Story_userId_createdAt_idx" ON "Story"("userId", "createdAt");
