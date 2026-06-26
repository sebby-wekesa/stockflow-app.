-- Assign chart accounts to branches for branch-grouped financial statement UI.
-- Existing accounts with posted activity in exactly one branch are backfilled
-- to that branch; shared accounts remain unassigned for manual classification.

ALTER TABLE "ChartAccount" ADD COLUMN "branchId" TEXT;

WITH account_branch AS (
  SELECT
    ll."accountId",
    MIN(je."branchId") AS "branchId",
    COUNT(DISTINCT je."branchId") AS branch_count
  FROM "LedgerLine" ll
  INNER JOIN "JournalEntry" je ON je."id" = ll."journalEntryId"
  WHERE je."branchId" IS NOT NULL
  GROUP BY ll."accountId"
)
UPDATE "ChartAccount" ca
SET "branchId" = account_branch."branchId"
FROM account_branch
WHERE ca."id" = account_branch."accountId"
  AND ca."branchId" IS NULL
  AND account_branch.branch_count = 1;

CREATE INDEX "ChartAccount_organizationId_branchId_idx"
  ON "ChartAccount"("organizationId", "branchId");

ALTER TABLE "ChartAccount"
  ADD CONSTRAINT "ChartAccount_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
