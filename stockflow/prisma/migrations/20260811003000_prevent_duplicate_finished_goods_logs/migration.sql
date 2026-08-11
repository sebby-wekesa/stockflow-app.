ALTER TABLE "FinishedGoodsProductionLog"
ADD COLUMN "submissionId" TEXT;

CREATE UNIQUE INDEX "FinishedGoodsProductionLog_org_submissionId_key"
ON "FinishedGoodsProductionLog"("organizationId", "submissionId");
