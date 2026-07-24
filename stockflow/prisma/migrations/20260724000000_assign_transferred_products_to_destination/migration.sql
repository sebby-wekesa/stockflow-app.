-- Products follow the latest received transfer in the catalogue. Branch stock
-- rows remain the source of truth for quantities held at each branch.
WITH latest_received_transfer AS (
    SELECT DISTINCT ON ("organizationId", "productId")
        "organizationId",
        "productId",
        "destinationBranchId"
    FROM "StockTransfer"
    WHERE "status" = 'RECEIVED'
    ORDER BY
        "organizationId",
        "productId",
        COALESCE("receivedAt", "createdAt") DESC,
        "createdAt" DESC,
        "id" DESC
)
UPDATE "Product" AS product
SET "branchId" = latest."destinationBranchId"
FROM latest_received_transfer AS latest
WHERE product."id" = latest."productId"
  AND product."organizationId" = latest."organizationId"
  AND product."branchId" IS DISTINCT FROM latest."destinationBranchId";
