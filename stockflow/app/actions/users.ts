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
    const branchId = formData.get('branchId') as string;

    if (!email || !name || !role || !branchId) {
      return { success: false, error: "All fields are required" };
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
    await prisma.user.create({
      data: {
        id: authUser.user!.id,
        email,
        name,
        role: role as typeof USER_ROLES[number],
        organizationId: "org-1", // TODO: get from current user
        branchId,
      }
    });

    // 3. Create profile in Supabase
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user!.id,
        email,
        full_name: name,
        role,
      });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Don't fail the whole operation
    }

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

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: normalizedRole })
    .eq('id', userId);

  if (error) {
    console.error("Role update error:", error);
    throw new Error("Failed to update user role");
  }

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

  // Delete from Supabase profiles table
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileError) {
    console.error("Profile delete error:", profileError);
  }

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
    const branchId = formData.get('branchId') as string;

    if (!userId || !name || !role || !branchId) {
      throw new Error("All fields are required");
    }

    if (typeof role !== "string" || !USER_ROLES.includes(role as typeof USER_ROLES[number])) {
      throw new Error("Invalid role");
    }

    // Update user in Prisma
    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        role: role as typeof USER_ROLES[number],
        branchId,
      }
    });

    // Update profile in Supabase
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: name,
        role,
      })
      .eq('id', userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
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
