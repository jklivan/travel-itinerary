-- Group trips (#116): members of a trip (invited or joined, by person or link), places deleted from a group trip
-- (kept to restore), each member's own stars, notes and photos on a place, and who added a place.
-- AlterTable
ALTER TABLE "DestItem" ADD COLUMN     "addedById" TEXT;

-- CreateTable
CREATE TABLE "TripMember" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "userId" TEXT,
    "invitedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "token" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "TripMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletedPlace" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "destinationId" TEXT,
    "data" JSONB NOT NULL,
    "deletedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceTake" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "notes" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceTake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripMember_token_key" ON "TripMember"("token");

-- CreateIndex
CREATE INDEX "TripMember_userId_status_idx" ON "TripMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TripMember_itineraryId_userId_key" ON "TripMember"("itineraryId", "userId");

-- CreateIndex
CREATE INDEX "DeletedPlace_itineraryId_deletedAt_idx" ON "DeletedPlace"("itineraryId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceTake_itemId_userId_key" ON "PlaceTake"("itemId", "userId");

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletedPlace" ADD CONSTRAINT "DeletedPlace_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletedPlace" ADD CONSTRAINT "DeletedPlace_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceTake" ADD CONSTRAINT "PlaceTake_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceTake" ADD CONSTRAINT "PlaceTake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestItem" ADD CONSTRAINT "DestItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

