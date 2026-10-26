-- "Send trips to Postcard" addresses are now stored whole (jen.rosenthal, or trips-abm942ehm3 for the first ones),
-- so people can choose a memorable one. The few made so far were stored without their "trips-" start: add it back,
-- so those addresses keep working.
UPDATE "User" SET "inboxToken" = 'trips-' || "inboxToken" WHERE "inboxToken" ~ '^[a-z2-9]{10}$';
