-- An emailed trip being imported: when it started (cleared when its places are in).
ALTER TABLE "Itinerary" ADD COLUMN "importingSince" TIMESTAMP(3);
