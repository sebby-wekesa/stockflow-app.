// lib/types.ts
export const USER_ROLES = ['PENDING', 'ADMIN', 'MANAGER', 'OPERATOR', 'SALES', 'PACKAGING', 'WAREHOUSE'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const USER_ROLE_SET = new Set<string>(USER_ROLES);

export function normalizeUserRole(role: unknown): UserRole {
  if (typeof role !== 'string') {
    return 'PENDING';
  }

  const normalizedRole = role.toUpperCase();
  return USER_ROLE_SET.has(normalizedRole) ? (normalizedRole as UserRole) : 'PENDING';
}

export const ROLE_PATHS: Record<UserRole, string> = {
  PENDING: '/dashboard',
  ADMIN: '/admin/dashboard',
  MANAGER: '/manager',
  OPERATOR: '/operator',
  SALES: '/sales',
  PACKAGING: '/packaging',
  WAREHOUSE: '/warehouse',
};

export const ROLE_NAMES: Record<UserRole, string> = {
  PENDING: 'Pending Approval',
  ADMIN: 'Administrator',
  MANAGER: 'Production Manager',
  OPERATOR: 'Operator',
  SALES: 'Sales Team',
  PACKAGING: 'Packaging Team',
  WAREHOUSE: 'Warehouse Team',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  PENDING: 'var(--muted)',
  ADMIN: 'var(--accent)',
  MANAGER: 'var(--accent)',
  OPERATOR: 'var(--purple)',
  SALES: 'var(--teal)',
  PACKAGING: 'var(--green)',
  WAREHOUSE: 'var(--muted)',
};
