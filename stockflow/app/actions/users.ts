"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeUserRole, USER_ROLES } from "@/lib/types";

async function assertAdminAccess() {
  const currentUser = await getUser();

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function inviteUser(formData: FormData) {
  try {
    await assertAdminAccess();

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
      password: "tempPassword123!", // Temporary password, user should change
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

    // 2. Create user in Prisma
    const createData: any = {
      id: authUser.user!.id,
      email,
      name,
      role: role as typeof USER_ROLES[number],
      organizationId: "org-1", // TODO: get from current user
    };
    if (branchId) createData.branchId = branchId;

    await prisma.user.create({ data: createData });

    // profiles table removed - Prisma User is the source of truth

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Invite Error:", error);
    return { success: false, error: "Failed to invite user." };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  await assertAdminAccess();

  if (typeof newRole !== "string" || !USER_ROLES.includes(newRole.toUpperCase() as typeof USER_ROLES[number])) {
    throw new Error("Invalid role");
  }

  const normalizedRole = normalizeUserRole(newRole);

  // profiles table removed - role is stored in Prisma User

  revalidatePath('/admin/users'); // Refresh the UI immediately
}

export async function deleteUser(userId: string) {
  await assertAdminAccess();

  // First delete related records that reference this user
  await prisma.auditLog.deleteMany({
    where: { userId },
  });

  await prisma.stageLog.deleteMany({
    where: { operatorId: userId },
  });

  await prisma.notificationSettings.deleteMany({
    where: { userId },
  });

  // profiles table removed - deletion handled via Prisma + Auth

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

export async function updateUser(formData: FormData) {
  try {
    await assertAdminAccess();

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

    // Update user in Prisma
    const updateData: any = {
      name,
      role: role as typeof USER_ROLES[number],
    };

    // Only include branchId if it looks like a valid UUID (avoid foreign key violations from old string codes)
    const isValidUuid = branchId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
    if (isValidUuid) {
      updateData.branchId = branchId;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // profiles table removed - using Prisma User model instead

    // Update Supabase Auth user metadata so role changes take effect immediately
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { name, role }
    });

    if (authError) {
      console.error("Auth metadata update error:", authError);
    }

    revalidatePath("/users");
  } catch (error) {
    console.error("Update user error:", error);
    throw error;
  }
}

export async function getBranches() {
  return await prisma.branch.findMany({
    orderBy: { name: 'asc' }
  });
}
