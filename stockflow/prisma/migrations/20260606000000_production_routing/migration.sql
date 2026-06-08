-- Additive production routing and operation timing.

CREATE TYPE "RouteType" AS ENUM ('FML', 'HML');
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

ALTER TABLE "Product" ADD COLUMN "routeType" "RouteType";
ALTER TABLE "ProductionOrder" ADD COLUMN "productId" TEXT;
ALTER TABLE "ProductionOrder" ADD COLUMN "routeType" "RouteType";
ALTER TABLE "ProductionOrder" ADD COLUMN "productionStartedAt" TIMESTAMP(3);
ALTER TABLE "ProductionOrder" ADD COLUMN "productionFinishedAt" TIMESTAMP(3);

CREATE TABLE "ProductionRoute" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteOperation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RouteOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "routeOperationId" TEXT,
    "operationName" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "section" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "operatorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionRoute_organizationId_routeType_key" ON "ProductionRoute"("organizationId", "routeType");
CREATE INDEX "ProductionRoute_organizationId_idx" ON "ProductionRoute"("organizationId");
CREATE UNIQUE INDEX "RouteOperation_routeId_sequence_key" ON "RouteOperation"("routeId", "sequence");
CREATE INDEX "RouteOperation_organizationId_idx" ON "RouteOperation"("organizationId");
CREATE INDEX "RouteOperation_routeId_idx" ON "RouteOperation"("routeId");
CREATE UNIQUE INDEX "OperationLog_productionOrderId_sequence_key" ON "OperationLog"("productionOrderId", "sequence");
CREATE INDEX "OperationLog_organizationId_idx" ON "OperationLog"("organizationId");
CREATE INDEX "OperationLog_productionOrderId_idx" ON "OperationLog"("productionOrderId");
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");

ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionRoute" ADD CONSTRAINT "ProductionRoute_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteOperation" ADD CONSTRAINT "RouteOperation_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "ProductionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteOperation" ADD CONSTRAINT "RouteOperation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_productionOrderId_fkey"
    FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_routeOperationId_fkey"
    FOREIGN KEY ("routeOperationId") REFERENCES "RouteOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_operatorId_fkey"
    FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the canonical routes for every existing organization.
INSERT INTO "ProductionRoute" ("id", "organizationId", "routeType", "name", "isActive", "updatedAt")
SELECT 'route-fml-' || id, id, 'FML', 'Leaf Spring - FML', true, CURRENT_TIMESTAMP
FROM "Organization";

INSERT INTO "ProductionRoute" ("id", "organizationId", "routeType", "name", "isActive", "updatedAt")
SELECT 'route-hml-' || id, id, 'HML', 'Leaf Spring - HML', true, CURRENT_TIMESTAMP
FROM "Organization";

INSERT INTO "RouteOperation" ("id", "organizationId", "routeId", "name", "sequence", "optional", "section", "updatedAt")
SELECT 'route-fml-' || o.id || '-op-' || operation.sequence, o.id, 'route-fml-' || o.id,
       operation.name, operation.sequence, operation.optional, operation.section, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  (1, 'Cutting', false, NULL::TEXT),
  (2, 'Eye Rolling', true, 'Eye Rolling Section'),
  (3, 'Scaffolding', true, 'Eye Rolling Section'),
  (4, 'Tapering', true, 'Eye Rolling Section'),
  (5, 'Drilling', false, NULL::TEXT),
  (6, 'Hardening', false, NULL::TEXT),
  (7, 'Tempering', false, NULL::TEXT),
  (8, 'Hardness Testing', false, NULL::TEXT),
  (9, 'Cambering', false, NULL::TEXT),
  (10, 'Assembly', true, NULL::TEXT),
  (11, 'Painting', false, NULL::TEXT)
) AS operation(sequence, name, optional, section);

INSERT INTO "RouteOperation" ("id", "organizationId", "routeId", "name", "sequence", "optional", "section", "updatedAt")
SELECT 'route-hml-' || o.id || '-op-' || operation.sequence, o.id, 'route-hml-' || o.id,
       operation.name, operation.sequence, operation.optional, NULL, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  (1, 'Cutting', false),
  (2, 'Drilling', false),
  (3, 'Hardening', false),
  (4, 'Tempering', false),
  (5, 'Hardness Testing', false),
  (6, 'Cambering', false),
  (7, 'Assembly', true),
  (8, 'Painting', false)
) AS operation(sequence, name, optional);
