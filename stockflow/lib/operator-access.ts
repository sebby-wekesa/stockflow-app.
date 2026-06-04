import type { AuthUser } from '@/lib/auth'

export function getOperatorDepartments(user: AuthUser): string[] {
  if (user.departments.length > 0) return user.departments
  return user.department ? [user.department] : []
}

export function assertOperatorDepartment(user: AuthUser, department: string | null | undefined) {
  if (user.role !== 'OPERATOR') return
  if (!department || !getOperatorDepartments(user).includes(department)) {
    throw new Error('Unauthorized: Job is not assigned to one of your departments')
  }
}
