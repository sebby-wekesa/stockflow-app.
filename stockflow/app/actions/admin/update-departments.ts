'use server'

import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireRole } from '@/lib/auth'
import { z } from 'zod'
import { setDepartmentsForOrg } from '@/lib/department-settings'

const deptListSchema = z.array(z.string().min(1))

export async function updateDepartments(organizationId: string, depts: string[]) {
  // Only admins can change department names
  await requireRole('ADMIN')
  const parsed = deptListSchema.parse(depts)
  const success = setDepartmentsForOrg(organizationId, parsed)
  if (!success) throw new Error('Failed to save department settings')
  return { success: true }
}
