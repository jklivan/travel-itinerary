-- Optional: days spent in each destination, and nights booked at a hotel. Both nullable, so existing rows are unchanged.
ALTER TABLE "Destination" ADD COLUMN "days" INTEGER;
ALTER TABLE "DestItem" ADD COLUMN "nights" INTEGER;
