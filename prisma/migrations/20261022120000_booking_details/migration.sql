-- Private booking details on a place (confirmation numbers, seats), shown only to the trip's owner.
ALTER TABLE "DestItem" ADD COLUMN "bookingDetails" TEXT;
