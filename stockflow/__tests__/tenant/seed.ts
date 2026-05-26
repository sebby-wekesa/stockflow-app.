/**
 * Test Tenant Seeding Utility
 *
 * Used by isolation tests to ensure two distinct organizations exist with data.
 *
 * This is intentionally separate from the main prisma/seed.ts so it can be
 * lightweight and focused on isolation scenarios.
 */

import { prisma } from '@/lib/prisma'

export interface TestOrgs {
  orgA: { id: string; name: string }
  orgB: { id: string; name: string }
}

export async function seedTwoTestOrgs(): Promise<TestOrgs> {
  const orgA = await prisma.organization.upsert({
    where: { code: 'TESTA' },
    update: {},
    create: {
      id: 'org-test-a',
      name: 'Test Organization Alpha',
      code: 'TESTA',
      slug: 'test-alpha',
      status: 'ACTIVE',
    },
  })

  const orgB = await prisma.organization.upsert({
    where: { code: 'TESTB' },
    update: {},
    create: {
      id: 'org-test-b',
      name: 'Test Organization Beta',
      code: 'TESTB',
      slug: 'test-beta',
      status: 'ACTIVE',
    },
  })

  // Minimal data for Org A
  await prisma.product.upsert({
    where: { id: 'prod-a-001' },
    update: {},
    create: {
      id: 'prod-a-001',
      organizationId: orgA.id,
      name: 'Alpha Steel Rod',
      sku: 'ALPHA-ROD-001',
      currentStock: 500,
      origin: 'LOCAL_PURCHASE',
    },
  })

  // Minimal data for Org B (should never be visible to Org A queries)
  await prisma.product.upsert({
    where: { id: 'prod-b-001' },
    update: {},
    create: {
      id: 'prod-b-001',
      organizationId: orgB.id,
      name: 'Beta Copper Wire',
      sku: 'BETA-WIRE-001',
      currentStock: 300,
      origin: 'IMPORTED',
    },
  })

  // --- Seed minimal data for StageLog + ProductionOrder isolation tests ---

  // Design for Org A (with explicit stages for multi-stage handoff testing)
  const designA = await prisma.design.upsert({
    where: { id: 'design-test-a' },
    update: {},
    create: {
      id: 'design-test-a',
      organizationId: orgA.id,
      name: 'Test Gear A',
      code: 'TGA',
    },
  })

  // Explicit stages for design A
  await prisma.stage.createMany({
    data: [
      { id: 'stage-a-1', organizationId: orgA.id, designId: designA.id, name: 'Cutting', department: 'Cutting', sequence: 1 },
      { id: 'stage-a-2', organizationId: orgA.id, designId: designA.id, name: 'Bending', department: 'Bending', sequence: 2 },
      { id: 'stage-a-3', organizationId: orgA.id, designId: designA.id, name: 'Welding', department: 'Welding', sequence: 3 },
    ],
    skipDuplicates: true,
  })

  // Bill of Materials for Org A design (required for consumeMaterialsForOrder to work)
  await prisma.billOfMaterials.upsert({
    where: { id: 'bom-a-001' },
    update: {},
    create: {
      id: 'bom-a-001',
      organizationId: orgA.id,
      designId: designA.id,
      rawMaterialId: 'rm-a-001',
      quantity: 5,
      unitOfMeasure: 'kg',
    },
  })

  // Production Order for Org A
  await prisma.productionOrder.upsert({
    where: { id: 'po-test-a' },
    update: {},
    create: {
      id: 'po-test-a',
      organizationId: orgA.id,
      orderNumber: 'PO-TEST-A',
      designId: designA.id,
      quantity: 10,
      targetKg: 100,
      status: 'IN_PRODUCTION',
      currentDept: 'Cutting',
      currentStage: 1,
    },
  })

  // StageLog for Org A (pre-complete stage 1 so multi-stage test can cleanly do stage 2+)
  await prisma.stageLog.upsert({
    where: { id: 'log-test-a' },
    update: {},
    create: {
      id: 'log-test-a',
      organizationId: orgA.id,
      orderId: 'po-test-a',
      stageName: 'Cutting',
      kgIn: 100,
      kgOut: 95,
      kgScrap: 5,
      operatorId: 'seed-op-a',
      sequence: 1,
    },
  })

  // Update the order to be ready for stage 2
  await prisma.productionOrder.update({
    where: { id: 'po-test-a' },
    data: { currentStage: 2, currentDept: 'Bending' },
  })

  // Design for Org B
  const designB = await prisma.design.upsert({
    where: { id: 'design-test-b' },
    update: {},
    create: {
      id: 'design-test-b',
      organizationId: orgB.id,
      name: 'Test Gear B',
      code: 'TGB',
    },
  })

  // Explicit stages for design B
  await prisma.stage.createMany({
    data: [
      { id: 'stage-b-1', organizationId: orgB.id, designId: designB.id, name: 'Welding', department: 'Welding', sequence: 1 },
      { id: 'stage-b-2', organizationId: orgB.id, designId: designB.id, name: 'Assembly', department: 'Assembly', sequence: 2 },
    ],
    skipDuplicates: true,
  })

  // Production Order for Org B (must remain invisible to Org A)
  await prisma.productionOrder.upsert({
    where: { id: 'po-test-b' },
    update: {},
    create: {
      id: 'po-test-b',
      organizationId: orgB.id,
      orderNumber: 'PO-TEST-B',
      designId: designB.id,
      quantity: 5,
      targetKg: 50,
      status: 'IN_PRODUCTION',
      currentDept: 'Welding',
      currentStage: 1,
    },
  })

  // StageLog for Org B
  await prisma.stageLog.upsert({
    where: { id: 'log-test-b' },
    update: {},
    create: {
      id: 'log-test-b',
      organizationId: orgB.id,
      orderId: 'po-test-b',
      stageName: 'Welding',
      kgIn: 50,
      kgOut: 48,
      kgScrap: 2,
      operatorId: 'seed-op-b',
      sequence: 1,
    },
  })

  // --- Seed data for Material Consumption + SaleOrder isolation tests ---

  // Raw Material for Org A
  await prisma.rawMaterial.upsert({
    where: { id: 'rm-a-001' },
    update: {},
    create: {
      id: 'rm-a-001',
      organizationId: orgA.id,
      materialName: 'Alpha Steel Stock',
      sku: 'RM-ALPHA-001',
      diameter: '10mm',
      availableKg: 1000,
      reservedKg: 0,
    },
  })

  // Material Consumption Log for Org A (linked to the Production Order)
  await prisma.materialConsumptionLog.upsert({
    where: { id: 'mcl-a-001' },
    update: {},
    create: {
      id: 'mcl-a-001',
      organizationId: orgA.id,
      productionOrderId: 'po-test-a',
      rawMaterialId: 'rm-a-001',
      quantityConsumed: 50,
      notes: 'Test consumption for Org A',
    },
  })

  // Raw Material for Org B (must stay invisible to Org A)
  await prisma.rawMaterial.upsert({
    where: { id: 'rm-b-001' },
    update: {},
    create: {
      id: 'rm-b-001',
      organizationId: orgB.id,
      materialName: 'Beta Copper Stock',
      sku: 'RM-BETA-001',
      diameter: '8mm',
      availableKg: 800,
      reservedKg: 0,
    },
  })

  // Material Consumption Log for Org B
  await prisma.materialConsumptionLog.upsert({
    where: { id: 'mcl-b-001' },
    update: {},
    create: {
      id: 'mcl-b-001',
      organizationId: orgB.id,
      productionOrderId: 'po-test-b',
      rawMaterialId: 'rm-b-001',
      quantityConsumed: 30,
      notes: 'Test consumption for Org B',
    },
  })

  // Simple SaleOrder for Org A (using existing product)
  await prisma.saleOrder.upsert({
    where: { id: 'so-test-a' },
    update: {},
    create: {
      id: 'so-test-a',
      organizationId: orgA.id,
      status: 'CONFIRMED',
      totalAmount: 1250,
      customerName: 'Test Customer Alpha',
    },
  })

  // FinishedGoods for Org A (required for fulfillOrder)
  await prisma.finishedGoods.upsert({
    where: { id: 'fg-a-001' },
    update: {},
    create: {
      id: 'fg-a-001',
      organizationId: orgA.id,
      designId: designA.id,
      sku: 'FG-TEST-A',
      quantity: 20,
      kgProduced: 200,
    },
  })

  // SaleItem for Org A
  await prisma.saleItem.upsert({
    where: { id: 'si-a-001' },
    update: {},
    create: {
      id: 'si-a-001',
      saleOrderId: 'so-test-a',
      finishedGoodsId: 'fg-a-001',
      organizationId: orgA.id,
      quantity: 5,
      unitPrice: 250,
      totalPrice: 1250,
    },
  })

  // SaleOrder for Org B (must not leak)
  await prisma.saleOrder.upsert({
    where: { id: 'so-test-b' },
    update: {},
    create: {
      id: 'so-test-b',
      organizationId: orgB.id,
      status: 'CONFIRMED',
      totalAmount: 980,
      customerName: 'Test Customer Beta',
    },
  })

  // FinishedGoods for Org B
  await prisma.finishedGoods.upsert({
    where: { id: 'fg-b-001' },
    update: {},
    create: {
      id: 'fg-b-001',
      organizationId: orgB.id,
      designId: designB.id,
      sku: 'FG-TEST-B',
      quantity: 15,
      kgProduced: 150,
    },
  })

  // SaleItem for Org B
  await prisma.saleItem.upsert({
    where: { id: 'si-b-001' },
    update: {},
    create: {
      id: 'si-b-001',
      saleOrderId: 'so-test-b',
      finishedGoodsId: 'fg-b-001',
      organizationId: orgB.id,
      quantity: 4,
      unitPrice: 245,
      totalPrice: 980,
    },
  })

  return {
    orgA: { id: orgA.id, name: orgA.name },
    orgB: { id: orgB.id, name: orgB.name },
  }
}

export async function cleanupTestOrgs() {
  // Careful deletion order due to foreign keys
  await prisma.materialConsumptionLog.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.saleItem.deleteMany({
    where: { SaleOrder: { organizationId: { in: ['org-test-a', 'org-test-b'] } } },
  })

  await prisma.finishedGoods.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.saleOrder.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.stageLog.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.productionOrder.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.design.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.rawMaterial.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.product.deleteMany({
    where: { organizationId: { in: ['org-test-a', 'org-test-b'] } },
  })

  await prisma.organization.deleteMany({
    where: { id: { in: ['org-test-a', 'org-test-b'] } },
  })
}
