import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { scryptSync, randomBytes } from 'crypto'

// Simple password hashing function
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function seedDesigns() {
  const designs = [
    {
      name: "Industrial Steel Gear",
      code: "SG-001",
      description: "High-grade carbon steel gear for heavy machinery.",
    },
    {
      name: "Aluminum Housing Unit",
      code: "AH-X2",
      description: "Lightweight aerospace-grade aluminum casing.",
    },
    {
      name: "Reinforced Brass Valve",
      code: "BV-PRO",
      description: "Corrosion-resistant brass valve for fluid control.",
    },
  ];

  console.log("--- Seeding Designs ---");

  for (const design of designs) {
    await prisma.design.upsert({
      where: { code: design.code },
      update: {}, // Don't change if it already exists
      create: design,
    });
  }

  console.log(`✅ Seeded ${designs.length} designs.`);
}

async function main() {
  console.log('--- Starting StockFlow Seed ---')
  
  // Hash the password
  const hashedPassword = hashPassword('password123')
  
  const admin = await prisma.user.upsert({
    where: { email: 'sebby@admin.com' },
    update: {
      role: 'ADMIN',
      password: hashedPassword,
    },
    create: {
      email: 'sebby@admin.com',
      name: 'Sebby Admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin user created/updated:', admin.email)
  console.log('📝 Default password: password123')
  
  await seedDesigns()
  console.log('--- Seed Finished Successfully ---')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })