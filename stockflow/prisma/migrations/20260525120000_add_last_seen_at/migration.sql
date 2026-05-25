-- Add lastSeenAt columns (added to schema after multitenancy migration)
-- These columns were missing in the database, causing PrismaClientKnownRequestError on User/Design queries

ALTER TABLE "public"."User" 
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "public"."Design" 
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
