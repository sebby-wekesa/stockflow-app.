"use server";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeUserRole, USER_ROLES } from "@/lib/types";

async function assertAdminAccess() {
  const currentUser = await requireActiveAuth();

  if (currentUser.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return currentUser;
}

export async function inviteUser(_prevState: unknown, formData: FormData) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);

    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;
    const branchId = formData.get('branchId') as string | null;

    if (!email || !name || !role) {
      return { success: false, error: "Email, name and role are required" };
    }

    if (typeof role !== "string" || !USER_ROLES.includes(role as typeof USER_ROLES[number])) {
      return { success: false, error: "Invalid role" };
    }

    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "tempPassword123!",
      email_confirm: true,
      user_metadata: {
        name,
        role,
      }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
         return { success: false, error: "User with this email already exists." };
      }
      throw new Error(`Auth Error: ${authError.message}`);
    }

    // 2. Create user in Prisma (properly tenant-scoped)
    const createData: any = {
      id: authUser.user!.id,
      email,
      name,
      role: role as typeof USER_ROLES[number],
      organizationId: currentUser.organizationId,
    };
    if (branchId) createData.branchId = branchId;

    await db.user.create({ data: createData });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Invite Error:", error);
    return { success: false, error: "Failed to invite user." };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  const currentUser = await assertAdminAccess();
  const db = getTenantPrisma(currentUser.organizationId);

  if (typeof newRole !== "string" || !USER_ROLES.includes(newRole.toUpperCase() as typeof USER_ROLES[number])) {
    throw new Error("Invalid role");
  }

  const normalizedRole = normalizeUserRole(newRole);

  await db.user.update({
    where: { id: userId, organizationId: currentUser.organizationId },
    data: { role: normalizedRole },
  });

  revalidatePath('/admin/users');
  revalidatePath('/users');
}

export async function verifyUser(userId: string) {
  const currentUser = await assertAdminAccess();
  const db = getTenantPrisma(currentUser.organizationId);

  const user = await db.user.findFirst({
    where: { id: userId, organizationId: currentUser.organizationId },
    select: { id: true, name: true, role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: {
      name: user.name,
      role: user.role,
    },
  });

  if (authError) {
    throw new Error(`Failed to verify user: ${authError.message}`);
  }

  revalidatePath("/users");
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const currentUser = await assertAdminAccess();
  const db = getTenantPrisma(currentUser.organizationId);

  // First delete related records that reference this user (tenant-scoped)
  await db.auditLog.deleteMany({
    where: { userId, organizationId: currentUser.organizationId },
  });

  await db.stageLog.deleteMany({
    where: { operatorId: userId, organizationId: currentUser.organizationId },
  });

  await db.notificationSettings.deleteMany({
    where: { userId, organizationId: currentUser.organizationId },
  });

  try {
    // Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      throw new Error(`Failed to delete from auth: ${authError.message}`);
    }

    revalidatePath("/admin/users");
  } catch (error) {
    console.error("Delete user error:", error);
    throw error;
  }
}

export async function updateUser(_prevState: unknown, maybeFormData?: FormData) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);
    const formData = maybeFormData ?? (_prevState as FormData);

    const userId = formData.get('userId') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;
    const branchId = formData.get('branchId') as string | null;

    if (!userId || !name || !role) {
      throw new Error("userId, name and role are required");
    }

    if (typeof role !== "string" || !USER_ROLES.includes(role as typeof USER_ROLES[number])) {
      throw new Error("Invalid role");
    }

    // Update user in Prisma (tenant-scoped)
    const updateData: any = {
      name,
      role: role as typeof USER_ROLES[number],
    };

    const isValidUuid = branchId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
    if (isValidUuid) {
      updateData.branchId = branchId;
    }

    await db.user.update({
      where: { id: userId, organizationId: currentUser.organizationId },
      data: updateData
    });

    // Update Supabase Auth user metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { name, role }
    });

    if (authError) {
      console.error("Auth metadata update error:", authError);
    }

    revalidatePath("/users");
    revalidatePath("/admin/users");
  } catch (error) {
    console.error("Update user error:", error);
    throw error;
  }
}

export async function getBranches() {
  const currentUser = await requireActiveAuth();
  const db = getTenantPrisma(currentUser.organizationId);

  return await db.branch.findMany({
    where: { organizationId: currentUser.organizationId },
    orderBy: { name: 'asc' }
  });
}
