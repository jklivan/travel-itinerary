-- Add status to Follow; existing rows get 'accepted' so nothing breaks
ALTER TABLE "Follow" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'accepted';

-- Add visibility to Itinerary; existing rows become 'public'
ALTER TABLE "Itinerary" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
