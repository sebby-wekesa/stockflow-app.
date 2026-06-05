import type { AuthUser } from '@/lib/auth'

export function getOperatorDepartments(user: AuthUser): string[] {
  if (user.departments.length > 0) return user.departments
  return user.department ? [user.department] : []
}

export function assertOperatorDepartment(user: AuthUser, department: string | null | undefined) {
  void user
  void department
}
