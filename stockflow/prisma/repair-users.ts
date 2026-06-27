import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USERS_TO_FIX = [
  { email: 'sebby@admin.com', password: 'password123', name: 'Sebby Admin', role: 'ADMIN' },
  { email: 'sales@stockflow.com', password: 'password123', name: 'Sales User', role: 'SALES' },
]

async function main() {
  console.log('--- User ID Repair Script ---')

  // 1. Find the existing organization
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true },
  })
  if (!org) {
    throw new Error('No organization found in the database. Run the full seed first.')
  }
  console.log(`Found organization: ${org.name} (${org.id})`)

  // 2. Find or create a branch
  let branch = await prisma.branch.findFirst({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  })

  if (!branch) {
    console.log('No branches found — creating default branches...')
    const seedBranches = [
      { id: 'branch-mombasa', name: 'Mombasa Branch', code: 'MSA', location: 'Mombasa' },
      { id: 'branch-nairobi', name: 'Nairobi Branch',  code: 'NBO', location: 'Nairobi' },
      { id: 'branch-bonje',   name: 'Bonje Branch',    code: 'BNJ', location: 'Bonje'   },
    ]
    for (const b of seedBranches) {
      await prisma.branch.upsert({
        where: { id: b.id },
        update: { name: b.name, code: b.code, location: b.location },
        create: { ...b, organizationId: org.id, updatedAt: new Date() },
      })
    }
    branch = await prisma.branch.findFirst({
      where: { organizationId: org.id },
      select: { id: true, name: true },
    })
    console.log(`✅ Created branches`)
  }
  console.log(`Using branch: ${branch!.name} (${branch!.id})`)


  // 3. List all Supabase auth users
  const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
  if (listError) throw listError
  console.log(`Found ${authUsers.length} Supabase auth users`)

  // 4. Fix each user
  for (const userData of USERS_TO_FIX) {
    console.log(`\n--- Processing: ${userData.email} ---`)

    // Find or create in Supabase auth
    let authUser = authUsers.find(u => u.email === userData.email)

    if (!authUser) {
      console.log(`  Creating Supabase auth user...`)
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { name: userData.name, role: userData.role },
      })
      if (error) throw error
      authUser = newUser.user
      console.log(`  Created auth user: ${authUser.id}`)
    } else {
      // Ensure password and metadata are current
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: userData.password,
        email_confirm: true,
        user_metadata: { name: userData.name, role: userData.role },
      })
      console.log(`  Auth user exists: ${authUser.id}`)
    }

    const supabaseId = authUser.id

    // Check existing Prisma user by email
    const existingByEmail = await prisma.user.findUnique({ where: { email: userData.email } })

    if (!existingByEmail) {
      // No prisma row at all — create it
       await prisma.user.create({
         data: {
           id: supabaseId,
           email: userData.email,
           name: userData.name,
           role: userData.role as any,
           organizationId: org.id,
           branchId: branch!.id,
           updatedAt: new Date(),
         },
       })
      console.log(`  ✅ Created Prisma user with id=${supabaseId}`)
     } else if (existingByEmail.id !== supabaseId) {
       // Row exists but ID is wrong — fix it
       console.log(`  ⚠️  ID mismatch: prisma=${existingByEmail.id}, supabase=${supabaseId}`)
       // Prisma doesn't support updating a PK directly, so delete + re-create
       await prisma.user.delete({ where: { email: userData.email } })
       await prisma.user.create({
         data: {
           id: supabaseId,
           email: userData.email,
           name: userData.name,
           role: userData.role as any,
           organizationId: org.id,
           branchId: branch!.id,
           updatedAt: new Date(),
         },
       })
       console.log(`  ✅ Repaired Prisma user id: ${existingByEmail.id} → ${supabaseId}`)
    } else {
      console.log(`  ✅ Already in sync (id=${supabaseId})`)
    }
  }

  console.log('\n--- Repair Complete ---')
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => {
    console.error('❌ Repair error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
