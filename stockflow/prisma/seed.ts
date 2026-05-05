import "dotenv/config";
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import { scryptSync, randomBytes } from 'crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Simple password hashing function matching auth system
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  console.log('🌱 Seeding StockFlow database...\n')

  // 1. Hash a default password (change this immediately after first login!)
  const hashedPassword = hashPassword('StockFlow2026!');

  const users = [
    {
      email: 'admin@stockflow.com',
      name: 'Super Admin',
      role: Role.ADMIN,
      department: 'Management',
    },
    {
      email: 'manager@stockflow.com',
      name: 'Production Manager',
      role: Role.MANAGER,
      department: 'Production',
    },
    {
      email: 'warehouse@stockflow.com',
      name: 'Inventory Lead',
      role: Role.WAREHOUSE,
      department: 'Warehouse',
    },
    {
      email: 'operator@stockflow.com',
      name: 'Cutting Operator',
      role: Role.OPERATOR,
      department: 'Cutting',
    },
    {
      email: 'sales@stockflow.com',
      name: 'Sales Rep',
      role: Role.SALES,
      department: 'Sales',
    },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // Don't change anything if they already exist
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        password: hashedPassword,
      },
    });
    console.log(`✅ Created/Verified user: ${user.email} as ${user.role}`);
  }

  // 2. Ensure organization exists
  let org = await prisma.organization.findFirst()
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'StockFlow Ltd' },
    })
    console.log(`✓ Created organization: ${org.name}`)
  } else {
    console.log(`✓ Using existing organization: ${org.name}`)
  }

  // 3. Seed suppliers
  const suppliers = [
    { name: 'SteelCorp', contactInfo: 'steelcorp@example.com' },
    { name: 'Fasteners Inc', contactInfo: 'fasteners@example.com' },
  ];

  for (const s of suppliers) {
    let supplier = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: s,
      });
    }
    console.log(`✅ Created/Found supplier: ${supplier.name}`);
  }

  // 4. Seed raw materials
  const rawMaterials = [
    { materialName: 'High-Tensile Steel', diameter: 'M12', availableKg: 1000, supplierName: 'SteelCorp' },
    { materialName: 'Mild Steel', diameter: 'M10', availableKg: 500, supplierName: 'SteelCorp' },
  ];

  for (const rm of rawMaterials) {
    const supplier = await prisma.supplier.findFirst({ where: { name: rm.supplierName } });
    if (supplier) {
      let rawMaterial = await prisma.rawMaterial.findFirst({
        where: { materialName: rm.materialName, diameter: rm.diameter },
      });
      if (!rawMaterial) {
        rawMaterial = await prisma.rawMaterial.create({
          data: {
            materialName: rm.materialName,
            diameter: rm.diameter,
            availableKg: rm.availableKg,
            supplierId: supplier.id,
          },
        });
      }
      console.log(`✅ Created/Found raw material: ${rm.materialName} ${rm.diameter}`);
    }
  }

  console.log('\n✓ Seed complete\n')
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });