-- Classify accounting journal entries by branch. Existing journals remain
-- unclassified; new transaction postings set this from the posting user.

ALTER TABLE "JournalEntry" ADD COLUMN "branchId" TEXT;

CREATE INDEX "JournalEntry_organizationId_branchId_idx" ON "JournalEntry"("organizationId", "branchId");

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
