import { supabaseServerComponent } from "./supabase-admin";
import { prisma } from "./prisma";
import { type UserRole } from "./types";

export type Role = UserRole;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  department: string | null;
  branches: { id: string; name: string }[];
};

export async function getUser() {
  const supabase = await supabaseServerComponent();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  try {
    // Check if User model exists and is accessible
    if (!prisma.user) {
      console.error("User model not available in Prisma client");
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        Branch: true,
        Organization: true,
      },
    });

    if (!user) {
      console.log("User not found in database for ID:", authUser.id);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      role: user.role,
      department: user.department,
      branches: user.Branch ? [{ id: user.Branch.id, name: user.Branch.name }] : [],
    };
  } catch (error) {
    console.error("Prisma lookup failed:", error);
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user as AuthUser;
}

export async function requireRole(...roles: Role[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }
  return user;
}

export async function checkRole(user: AuthUser | null, ...roles: Role[]): Promise<boolean> {
  if (!user) return false;
  return roles.includes(user.role);
}
