ALTER TABLE "DestItem" ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "DestItem" SET "photoUrls" = ARRAY["photoUrl"] WHERE "photoUrl" IS NOT NULL AND "photoUrl" <> '';
