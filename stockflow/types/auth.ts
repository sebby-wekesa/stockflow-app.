import type { UserRole } from "@/lib/types";

export type { UserRole };

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  department?: string;
}

// Map roles to their dedicated base routes
export const ROLE_HOME_PAGES: Record<UserRole, string> = {
  PENDING: '/dashboard', // PENDING users go to dashboard until approved
  ADMIN: '/admin/dashboard',
  MANAGER: '/manager',
  OPERATOR: '/operator',
  WAREHOUSE: '/warehouse',
  SALES: '/operator/queue',
  PACKAGING: '/packaging'
};