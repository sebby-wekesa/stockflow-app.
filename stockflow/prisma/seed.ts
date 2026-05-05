import "dotenv/config";
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import { scryptSync, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tkomvxmltdhzrfdhvunl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrb212eG1sdGRoenJmZGh2dW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg4NjM1MywiZXhwIjoyMDkzNDYyMzUzfQ.LTQ5VpKYuoMwa1v6-FkxAjPn75aY-ZOR3sc_vq5d5ss'
)

// Simple password hashing function matching auth system
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  console.log('🌱 Seeding StockFlow database...\n')

  // 0. Create organization
  let org = await prisma.organization.findFirst()
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'StockFlow Ltd' },
    })
    console.log(`✓ Created organization: ${org.name}`)
  } else {
    console.log(`✓ Using existing organization: ${org.name}`)
  }

  // 1. Create branches
  const branches = ['mombasa', 'nairobi', 'bonje']
  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { branch: branch as any },
      update: {},
      create: {
        branch: branch as any,
        name: branch.charAt(0).toUpperCase() + branch.slice(1),
        organizationId: org.id
      },
    })
  }
  console.log('✅ Branches created')

  // 1. Hash a default password (change this immediately after first login!)
  const defaultPassword = 'StockFlow2026!'
  const hashedPassword = hashPassword(defaultPassword);

  const users = [
    {
      email: 'admin@stockflow.com',
      name: 'Super Admin',
      role: 'ADMIN' as Role,
      branch: 'mombasa' as const,
    },
    {
      email: 'manager@stockflow.com',
      name: 'Production Manager',
      role: 'MANAGER' as Role,
      branch: 'mombasa' as const,
    },
    {
      email: 'warehouse@stockflow.com',
      name: 'Inventory Lead',
      role: 'WAREHOUSE' as Role,
      branch: 'mombasa' as const,
    },
    {
      email: 'operator@stockflow.com',
      name: 'Cutting Operator',
      role: 'OPERATOR' as Role,
      branch: 'mombasa' as const,
    },
    {
      email: 'sales@stockflow.com',
      name: 'Sales Rep',
      role: 'SALES' as Role,
      branch: 'nairobi' as const,
    },
  ];

  for (const u of users) {
    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: u.name,
      }
    })

    if (authError || !authData.user) {
      console.error(`Failed to create Supabase user for ${u.email}:`, authError)
      continue
    }

    // Get branch
    const branch = await prisma.branch.findUnique({ where: { branch: u.branch } })

    // Create in Prisma
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // Don't change anything if they already exist
      create: {
        id: authData.user.id,
        email: u.email,
        password: hashedPassword,
        full_name: u.name,
        role: u.role,
        branchId: branch?.id,
      },
    });
    console.log(`✅ Created/Verified user: ${user.email} as ${user.role}`);
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