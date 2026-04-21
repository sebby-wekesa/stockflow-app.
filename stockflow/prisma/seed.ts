import { PrismaClient, Role } from '@prisma/client';
import { scryptSync, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Simple password hashing function matching auth system
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  // 1. Hash a default password (change this immediately after first login!)
  const hashedPassword = hashPassword('StockFlow2026!');

  const users = [
    {
      email: 'admin@stockflow.com',
      name: 'Super Admin',
      role: Role.ADMIN,
      dept: 'Management',
    },
    {
      email: 'manager@stockflow.com',
      name: 'Production Manager',
      role: Role.MANAGER,
      dept: 'Production',
    },
    {
      email: 'warehouse@stockflow.com',
      name: 'Inventory Lead',
      role: Role.WAREHOUSE,
      dept: 'Warehouse',
    },
    {
      email: 'operator@stockflow.com',
      name: 'Cutting Operator',
      role: Role.OPERATOR,
      dept: 'Cutting',
    },
    {
      email: 'sales@stockflow.com',
      name: 'Sales Rep',
      role: Role.SALES,
      dept: 'Sales',
    },
  ];

  console.log('--- Starting Seeding Process ---');

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // Don't change anything if they already exist
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.dept,
        password: hashedPassword,
      },
    });
    console.log(`✅ Created/Verified user: ${user.email} as ${user.role}`);
  }

  console.log('--- Seeding Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });