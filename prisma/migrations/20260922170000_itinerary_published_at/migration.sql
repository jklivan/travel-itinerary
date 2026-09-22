ALTER TABLE "Itinerary" ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Itinerary" SET "publishedAt" = "createdAt" WHERE "visibility" <> 'draft';
