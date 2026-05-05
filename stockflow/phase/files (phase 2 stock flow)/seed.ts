/**
 * Seed script for Springtech StockFlow
 *
 * Loads a representative sample of products across all 5 categories,
 * including realistic aliases derived from the QuickBooks sales data
 * naming patterns.
 *
 * Run with:  npm run db:seed
 *
 * For the full 4,712 spring catalogue, use the Import Centre once
 * Phase 3 is built.
 */

import { PrismaClient } from '@prisma/client'
import { normaliseForMatching } from '../src/lib/import/alias-matcher'

const prisma = new PrismaClient()

type SeedProduct = {
  product_code: string
  canonical_name: string
  category:
    | 'manufactured_spring'
    | 'manufactured_ubolt'
    | 'imported'
    | 'local_purchase'
    | 'service'
  product_type: string
  uom?: 'pcs' | 'set' | 'kg' | 'litres' | 'metres' | 'box'
  vehicle_make?: string
  vehicle_model?: string
  spring_position?: string
  leaf_position?: string
  shaft_size_mm?: number
  leg_length_inch?: string
  cost_price?: number
  selling_price?: number
  reorder_point?: number
  aliases?: string[]
}

const PRODUCTS: SeedProduct[] = [
  // ── Manufactured springs (5 samples)
  {
    product_code: 'FH215/FSML',
    canonical_name: 'Mitsubishi FH215 Front Spring Main Leaf',
    category: 'manufactured_spring',
    product_type: 'leaf_spring',
    vehicle_make: 'Mitsubishi FH 215',
    vehicle_model: 'FH215',
    spring_position: 'Front',
    leaf_position: 'Main Leaf',
    cost_price: 3200,
    selling_price: 4500,
    reorder_point: 10,
    aliases: ['FH 215 F.M.L', 'FH215 FRONT MAIN LEAF', 'FH215 F.M.L'],
  },
  {
    product_code: 'FH215/RSML',
    canonical_name: 'Mitsubishi FH215 Rear Spring Main Leaf',
    category: 'manufactured_spring',
    product_type: 'leaf_spring',
    vehicle_make: 'Mitsubishi FH 215',
    vehicle_model: 'FH215',
    spring_position: 'Rear',
    leaf_position: 'Main Leaf',
    cost_price: 3500,
    selling_price: 4800,
    reorder_point: 10,
    aliases: ['FH 215 R.M.L', 'FH215 R.M.L'],
  },
  {
    product_code: 'DOLLTRLR/RSML',
    canonical_name: 'Doll Trailer Rear Spring Main Leaf',
    category: 'manufactured_spring',
    product_type: 'leaf_spring',
    vehicle_make: 'Doll Trailer',
    vehicle_model: 'DOLLTRLR',
    spring_position: 'Rear',
    leaf_position: 'Main Leaf',
    cost_price: 4400,
    selling_price: 6200,
    reorder_point: 15,
    aliases: ['DOLL R.M.L DOLL', 'DOLL R.M.L', 'DOLL RML', 'DOLL TRAILER R.M.L'],
  },
  {
    product_code: 'ISZFRR/HSML',
    canonical_name: 'Isuzu FRR Helper Spring Main Leaf',
    category: 'manufactured_spring',
    product_type: 'helper_spring',
    vehicle_make: 'Isuzu FRR',
    vehicle_model: 'FRR',
    spring_position: 'Helper',
    leaf_position: 'Main Leaf',
    cost_price: 2800,
    selling_price: 3900,
    reorder_point: 8,
    aliases: ['ISUZU FRR H.M.L', 'FRR HELPER MAIN LEAF', 'ISZ FRR HML'],
  },
  {
    product_code: 'HIACEN/RSML',
    canonical_name: 'Toyota HiAce N/M Rear Spring Main Leaf',
    category: 'manufactured_spring',
    product_type: 'leaf_spring',
    vehicle_make: 'Toyota HiAce',
    vehicle_model: 'HIACEN/M',
    spring_position: 'Rear',
    leaf_position: 'Main Leaf',
    cost_price: 1800,
    selling_price: 2600,
    reorder_point: 12,
    aliases: ['HIACE N/M R.M.L', 'HIACE N/M RML', 'HIACE NEW MODEL R.M.L'],
  },

  // ── Manufactured U-bolts (3 samples)
  {
    product_code: 'UB-FH215-F8',
    canonical_name: 'Front U-bolt FH 215 — 8"',
    category: 'manufactured_ubolt',
    product_type: 'u_bolt',
    vehicle_make: 'Mitsubishi FH 215',
    vehicle_model: 'FH215',
    spring_position: 'Front',
    shaft_size_mm: 24,
    leg_length_inch: '8"',
    cost_price: 850,
    selling_price: 1200,
    reorder_point: 30,
    aliases: ['UBOLT FH215 8"', 'U-BOLT FH 215 FRONT'],
  },
  {
    product_code: 'UB-DOLLTRLR-R17',
    canonical_name: 'Rear U-bolt Doll Trailer — 17"',
    category: 'manufactured_ubolt',
    product_type: 'u_bolt',
    vehicle_make: 'Doll Trailer',
    vehicle_model: 'DOLLTRLR',
    spring_position: 'Rear',
    shaft_size_mm: 28,
    leg_length_inch: '17"',
    cost_price: 1400,
    selling_price: 1900,
    reorder_point: 20,
  },
  {
    product_code: 'UB-ISZFRR-F10',
    canonical_name: 'Front U-bolt Isuzu FRR — 10"',
    category: 'manufactured_ubolt',
    product_type: 'u_bolt',
    vehicle_make: 'Isuzu FRR',
    spring_position: 'Front',
    shaft_size_mm: 22,
    leg_length_inch: '10"',
    cost_price: 950,
    selling_price: 1350,
    reorder_point: 25,
  },

  // ── Imported (3 samples)
  {
    product_code: 'IMP-BRG-804358',
    canonical_name: 'Bearing 804358',
    category: 'imported',
    product_type: 'bearing',
    cost_price: 1800,
    selling_price: 2500,
    reorder_point: 15,
    aliases: ['BEARING 804358', 'BRG 804358'],
  },
  {
    product_code: 'IMP-BRG-572630',
    canonical_name: 'Bearing 572630',
    category: 'imported',
    product_type: 'bearing',
    cost_price: 2100,
    selling_price: 2900,
    reorder_point: 10,
    aliases: ['BEARING 572630'],
  },
  {
    product_code: 'IMP-SEAL-OM',
    canonical_name: 'Oil seal — original mark',
    category: 'imported',
    product_type: 'seal',
    cost_price: 350,
    selling_price: 550,
    reorder_point: 50,
    aliases: ['OIL SEAL OM', 'OIL SEAL O/M'],
  },

  // ── Local purchase (4 samples — most alias variation)
  {
    product_code: 'BL-BC37-XTRAKE',
    canonical_name: 'Brake Lining BC37 Xtrake',
    category: 'local_purchase',
    product_type: 'brake_lining',
    uom: 'set',
    cost_price: 1700,
    selling_price: 2500,
    reorder_point: 20,
    aliases: [
      'BRAKELINING BC37 XTRAKE',
      'BRAKE LINING BC 37 XTRAKE',
      'BRAKE LINING XTRAKE BC 37',
      'BRAKE LINING BC37 XTRAKE',
      'BRAKELINING BC37 XTRAKE NM',
    ],
  },
  {
    product_code: 'BL-BC36-LONAFLEX',
    canonical_name: 'Brake Lining BC36 Lonaflex',
    category: 'local_purchase',
    product_type: 'brake_lining',
    uom: 'set',
    cost_price: 1500,
    selling_price: 2200,
    reorder_point: 20,
    aliases: ['BRAKE LINING BC36 LONAFLEX', 'BRAKELINING BC36 LONAFLEX'],
  },
  {
    product_code: 'BL-FH-REAR',
    canonical_name: 'Brake Lining FH Rear',
    category: 'local_purchase',
    product_type: 'brake_lining',
    uom: 'set',
    cost_price: 2100,
    selling_price: 3200,
    reorder_point: 15,
  },
  {
    product_code: 'IMP-CABUSH-METALLION',
    canonical_name: 'Control Arm Bush — Metallion',
    category: 'local_purchase',
    product_type: 'bush',
    cost_price: 800,
    selling_price: 1200,
    reorder_point: 25,
    aliases: ['CONTROL ARM MTLION BUSH MENCI', 'CONTROL ARM METALLION BUSH'],
  },

  // ── Services (3 samples)
  {
    product_code: 'SVC-RETENTION',
    canonical_name: 'Spring Assembly Retention',
    category: 'service',
    product_type: 'retention',
    selling_price: 1500,
    aliases: ['RETENTION', 'SPRING RETENTION'],
  },
  {
    product_code: 'SVC-REPAIR',
    canonical_name: 'Repair Done',
    category: 'service',
    product_type: 'repair',
    selling_price: 2000,
    aliases: ['REPAIR DONE', 'REPAIR'],
  },
  {
    product_code: 'SVC-RIVETING',
    canonical_name: 'Riveting Service',
    category: 'service',
    product_type: 'riveting',
    selling_price: 800,
    aliases: ['RIVETING'],
  },
]

async function main() {
  console.log('🌱 Seeding Springtech StockFlow database...\n')

  // 1. Ensure organisation exists
  let org = await prisma.organisation.findFirst()
  if (!org) {
    org = await prisma.organisation.create({
      data: { name: 'Springtech (K) Ltd' },
    })
    console.log(`✓ Created organisation: ${org.name}`)
  } else {
    console.log(`✓ Using existing organisation: ${org.name}`)
  }

  // 2. Seed products + aliases
  let createdCount = 0
  let skippedCount = 0

  for (const seed of PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { product_code: seed.product_code },
    })
    if (existing) {
      skippedCount++
      continue
    }

    const product = await prisma.product.create({
      data: {
        org_id: org.id,
        product_code: seed.product_code,
        canonical_name: seed.canonical_name,
        category: seed.category,
        product_type: seed.product_type as any,
        uom: seed.uom ?? 'pcs',
        vehicle_make: seed.vehicle_make,
        vehicle_model: seed.vehicle_model,
        spring_position: seed.spring_position,
        leaf_position: seed.leaf_position,
        shaft_size_mm: seed.shaft_size_mm,
        leg_length_inch: seed.leg_length_inch,
        cost_price: seed.cost_price,
        selling_price: seed.selling_price,
        reorder_point: seed.reorder_point,
      },
    })

    // Always add the canonical name as the first alias
    await prisma.productAlias.create({
      data: {
        product_id: product.id,
        alias: seed.canonical_name,
        alias_clean: normaliseForMatching(seed.canonical_name),
        source: 'canonical',
      },
    })

    // Add additional aliases
    for (const aliasText of seed.aliases ?? []) {
      const alias_clean = normaliseForMatching(aliasText)
      const conflict = await prisma.productAlias.findUnique({ where: { alias_clean } })
      if (conflict) continue
      await prisma.productAlias.create({
        data: {
          product_id: product.id,
          alias: aliasText,
          alias_clean,
          source: 'manual',
        },
      })
    }

    createdCount++
  }

  console.log(`\n✓ Seeded ${createdCount} products (${skippedCount} already existed)`)

  // Summary
  const counts = await prisma.product.groupBy({
    by: ['category'],
    _count: { _all: true },
  })

  console.log('\nProduct counts by category:')
  for (const c of counts) {
    console.log(`  · ${c.category.padEnd(22)} ${c._count._all}`)
  }

  const totalAliases = await prisma.productAlias.count()
  console.log(`\nTotal aliases: ${totalAliases}`)
  console.log('\n✓ Seed complete\n')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
