ALTER TABLE "Design" ADD COLUMN "category" TEXT;
ALTER TABLE "Design" ADD COLUMN "expectedYield" DOUBLE PRECISION;
ALTER TABLE "Design" ADD COLUMN "specifications" JSONB;
ALTER TABLE "Stage" ADD COLUMN "specifications" JSONB;
