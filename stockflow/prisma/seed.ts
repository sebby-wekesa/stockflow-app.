import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { scryptSync, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seedDesigns() {
  const designs = [
    {
      id: "design-sg-001",
      name: "Industrial Steel Gear",
      code: "SG-001",
      description: "High-grade carbon steel gear for heavy machinery.",
    },
    {
      id: "design-ah-x2",
      name: "Aluminum Housing Unit",
      code: "AH-X2",
      description: "Lightweight aerospace-grade aluminum casing.",
    },
    {
      id: "design-bv-pro",
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
      create: {
        ...design,
        updatedAt: new Date(),
      },
    });
  }

  console.log(`✅ Seeded ${designs.length} designs.`);
}

async function main() {
  console.log('--- Starting StockFlow Seed ---')

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { code: 'SF' },
    update: {},
    create: {
      id: 'org-stockflow-001',
      name: 'StockFlow Manufacturing',
      code: 'SF',
      updatedAt: new Date(),
    }
  });

  // 2. Create Branches
  const branches = [
    { id: 'branch-mombasa', name: 'Mombasa Branch', code: 'MSA', location: 'Mombasa', organizationId: org.id },
    { id: 'branch-nairobi', name: 'Nairobi Branch', code: 'NBO', location: 'Nairobi', organizationId: org.id },
    { id: 'branch-bunje', name: 'Bunje Branch', code: 'BNJ', location: 'Bunje', organizationId: org.id },
  ];

  const seededBranches = [];
  for (const branch of branches) {
    const b = await prisma.branch.upsert({
      where: { code: branch.code },
      update: { location: branch.location },
      create: {
        ...branch,
        updatedAt: new Date(),
      },
    });
    seededBranches.push(b);
  }
  console.log('✅ Branches seeded:', seededBranches.map(b => b.name).join(', '));

  const defaultBranchId = seededBranches[0].id;

  // 3. Helper to create user in both Auth and Prisma
  async function seedUser(userData: {
    email: string;
    password: string;
    name: string;
    role: any;
    organizationId: string;
    branchId: string;
  }) {
    let userId: string;

    console.log(`--- Seeding User: ${userData.email} ---`);

    // Check if user exists in Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = users.find(u => u.email === userData.email);

    if (existingAuthUser) {
      console.log(`User already exists in Auth: ${userData.email}`);
      userId = existingAuthUser.id;
    } else {
      // Create in Auth
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { name: userData.name, role: userData.role }
      });

      if (createError) {
        console.error(`Error creating auth user ${userData.email}:`, createError.message);
        // If it's a "user already exists" error that listUsers missed (unlikely but possible), 
        // we might need another strategy, but for now we stop.
        throw createError;
      }
      userId = newAuthUser.user.id;
      console.log(`Created new Auth user: ${userData.email} (${userId})`);
    }

    // Upsert in Prisma
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        role: userData.role,
        name: userData.name,
        organizationId: userData.organizationId,
        branchId: userData.branchId,
        updatedAt: new Date(),
      },
      create: {
        id: userId,
        email: userData.email,
        name: userData.name,
        password: hashPassword(userData.password),
        role: userData.role,
        organizationId: userData.organizationId,
        branchId: userData.branchId,
        updatedAt: new Date(),
      },
    });

    return user;
  }

  // Seed Admin
  const admin = await seedUser({
    email: 'sebby@admin.com',
    password: 'password123',
    name: 'Sebby Admin',
    role: 'ADMIN',
    organizationId: org.id,
    branchId: defaultBranchId,
  });
  console.log('✅ Admin user synced:', admin.email);

  // Seed Sales
  const sales = await seedUser({
    email: 'sales@stockflow.com',
    password: 'password123',
    name: 'Sales User',
    role: 'SALES',
    organizationId: org.id,
    branchId: defaultBranchId,
  });
  console.log('✅ Sales user synced:', sales.email);

  console.log('📝 Default password: password123');

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