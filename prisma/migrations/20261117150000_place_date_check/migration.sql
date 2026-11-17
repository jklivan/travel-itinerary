-- A booking imported for this place on a different day or time than it has: kept to ask which is right.
ALTER TABLE "DestItem" ADD COLUMN "dateCheck" JSONB;
