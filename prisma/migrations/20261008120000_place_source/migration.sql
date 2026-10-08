-- AlterTable
ALTER TABLE "DestItem" ADD COLUMN     "sourceItineraryId" TEXT,
ADD COLUMN     "sourceKind" TEXT,
ADD COLUMN     "sourceUserId" TEXT;

-- AddForeignKey
ALTER TABLE "DestItem" ADD CONSTRAINT "DestItem_sourceItineraryId_fkey" FOREIGN KEY ("sourceItineraryId") REFERENCES "Itinerary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestItem" ADD CONSTRAINT "DestItem_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

