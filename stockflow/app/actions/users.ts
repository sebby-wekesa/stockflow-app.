"use server";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeUserRole, USER_ROLES } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { getAuthCallbackUrl } from "@/lib/app-url";

type UserFormPayload = FormData | Record<string, FormDataEntryValue | null | undefined>;

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function resolveFormPayload(
  prevStateOrPayload: unknown,
  maybeFormData?: FormData
): UserFormPayload {
  const payload = maybeFormData ?? prevStateOrPayload;

  if (isFormData(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    return payload as Record<string, FormDataEntryValue | null | undefined>;
  }

  throw new Error("Invalid form submission");
}

function getPayloadValue(payload: UserFormPayload, name: string) {
  return isFormData(payload) ? payload.get(name) : payload[name];
}

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
    const payload = resolveFormPayload(_prevState, formData);

    const email = (getPayloadValue(payload, 'email') as string)?.trim().toLowerCase();
    const name = (getPayloadValue(payload, 'name') as string)?.trim();
    const role = getPayloadValue(payload, 'role') as string;
    const branchId = getPayloadValue(payload, 'branchId') as string | null;
    const departmentsValue = String(getPayloadValue(payload, 'departments') || '');
    const departments = Array.from(new Set(
      departmentsValue.split(',').map(value => value.trim()).filter(Boolean)
    ));

    if (!email || !name || !role) {
      return { success: false, error: "Email, name and role are required" };
    }

    if (typeof role !== "string" || !USER_ROLES.includes(role as typeof USER_ROLES[number])) {
      return { success: false, error: "Invalid role" };
    }

    const existingUser = await db.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return { success: false, error: "User with this email already exists." };
    }

    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      return { success: false, error: "Supabase admin client is not configured." };
    }

    // inviteUserByEmail creates the auth user and asks Supabase to deliver the
    // password-setup email. createUser does not send any email.
    const { data: authUser, error: authError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: getAuthCallbackUrl(),
        data: {
          name,
          role,
          organizationId: currentUser.organizationId,
        },
      }
    );
    if (authError) {
      if (authError.message.includes("already registered")) {
         return { success: false, error: "User with this email already exists." };
      }
      throw new Error(`Auth Error: ${authError.message}`);
    }

    if (!authUser.user) {
      throw new Error("Supabase did not return the invited user.");
    }

    try {
      await db.user.create({
        data: {
          id: authUser.user.id,
          email,
          name,
          role: role as typeof USER_ROLES[number],
          departments: role === 'OPERATOR' ? departments : [],
          department: role === 'OPERATOR' ? departments[0] ?? null : null,
          organizationId: currentUser.organizationId,
          ...(branchId ? { branchId } : {}),
        },
      });
    } catch (error) {
      // Do not leave an unusable auth-only account that prevents re-inviting.
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(authUser.user.id);
      if (cleanupError) {
        console.error("Failed to clean up invited auth user:", cleanupError);
      }
      throw error;
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Invite Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to invite user.",
    };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  const currentUser = await assertAdminAccess();
  const db = getTenantPrisma(currentUser.organizationId);

  if (typeof newRole !== "string" || !USER_ROLES.includes(newRole.toUpperCase() as typeof USER_ROLES[number])) {
    throw new Error("Invalid role");
  }

  const normalizedRole = normalizeUserRole(newRole);

  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { departments: true, department: true },
  });
  const existingDepartments = existing?.departments?.length
    ? existing.departments
    : existing?.department
      ? [existing.department]
      : [];
  await db.user.update({
    where: { id: userId, organizationId: currentUser.organizationId },
    data: {
      role: normalizedRole,
      departments: normalizedRole === 'OPERATOR' ? existingDepartments : [],
      department: normalizedRole === 'OPERATOR' ? existingDepartments[0] ?? null : null,
    },
  });

  revalidatePath('/admin/users');
  revalidatePath('/users');
}

export async function verifyUser(userId: string) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);
    const adminClient = getSupabaseAdmin();

    if (!adminClient) {
      return { success: false, error: "Supabase admin client is not configured" };
    }

    const user = await db.user.findFirst({
      where: { id: userId, organizationId: currentUser.organizationId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return { success: false, error: "User not found in this organization" };
    }

    const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: user.role,
      },
    });

    if (authError) {
      return { success: false, error: `Failed to verify user: ${authError.message}` };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Verify user error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify user",
    };
  }
}

export async function resendInvitation(userId: string) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);
    const adminClient = getSupabaseAdmin();

    if (!adminClient) {
      return { success: false, error: "Supabase admin client is not configured." };
    }

    const user = await db.user.findFirst({
      where: { id: userId, organizationId: currentUser.organizationId },
      select: { email: true, name: true, role: true },
    });
    if (!user) {
      return { success: false, error: "User not found in this organization." };
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(user.email, {
      redirectTo: getAuthCallbackUrl(),
      data: {
        name: user.name,
        role: user.role,
        organizationId: currentUser.organizationId,
      },
    });

    if (error) {
      return { success: false, error: `Could not resend invitation: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Resend invitation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not resend invitation.",
    };
  }
}

export async function linkAndVerifyAuthUser(authUserId: string) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);
    const adminClient = getSupabaseAdmin();

    if (!adminClient) {
      return { success: false, error: "Supabase admin client is not configured" };
    }

    const { data, error } = await adminClient.auth.admin.getUserById(authUserId);
    if (error || !data.user) {
      return { success: false, error: `Supabase user not found: ${error?.message ?? "Unknown error"}` };
    }

    const authUser = data.user;
    if (!authUser.email) {
      return { success: false, error: "Supabase user does not have an email address" };
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: authUser.id },
          { email: authUser.email },
        ],
      },
      select: { id: true, organizationId: true, role: true },
    });

    if (existingUser?.organizationId && existingUser.organizationId !== currentUser.organizationId) {
      return { success: false, error: "This user is already linked to another organization." };
    }

    if (!existingUser) {
      const name =
        typeof authUser.user_metadata?.name === "string"
          ? authUser.user_metadata.name
          : typeof authUser.user_metadata?.full_name === "string"
            ? authUser.user_metadata.full_name
            : authUser.email.split("@")[0];

      await db.user.create({
        data: {
          id: authUser.id,
          email: authUser.email,
          name,
          role: "PENDING",
          organizationId: currentUser.organizationId,
        },
      });
    } else if (!existingUser.organizationId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { organizationId: currentUser.organizationId },
      });
    }

    const role = existingUser?.role ?? "PENDING";
    const { data: updatedAuthUser, error: authError } = await adminClient.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
      user_metadata: {
        ...authUser.user_metadata,
        role,
      },
    });

    if (authError) {
      return { success: false, error: `Failed to verify user: ${authError.message}` };
    }

    if (!updatedAuthUser.user.email_confirmed_at) {
      return { success: false, error: "Supabase did not mark the email as verified" };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Add and verify auth user error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add and verify user",
    };
  }
}

export async function verifyAuthUserEmail(authUserId: string) {
  try {
    const currentUser = await assertAdminAccess();
    const adminClient = getSupabaseAdmin();

    if (!adminClient) {
      return { success: false, error: "Supabase admin client is not configured" };
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: authUserId },
      select: { id: true, organizationId: true },
    });

    if (!existingUser) {
      return { success: false, error: "App user record was not found" };
    }

    if (
      existingUser.organizationId &&
      existingUser.organizationId !== currentUser.organizationId
    ) {
      return {
        success: false,
        error: "This user belongs to another organization. Use the organization approval flow for that tenant.",
      };
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
    });

    if (error) {
      return { success: false, error: `Failed to verify user: ${error.message}` };
    }

    if (!data.user.email_confirmed_at) {
      return { success: false, error: "Supabase did not mark the email as verified" };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Verify auth user email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify user",
    };
  }
}

export async function deleteUser(userId: string) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);

    if (userId === currentUser.id) {
      return { success: false, error: "You cannot delete your own account." };
    }

    const user = await db.user.findFirst({
      where: { id: userId, organizationId: currentUser.organizationId },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: "User not found in this organization." };
    }

    await db.$transaction([
      db.auditLog.deleteMany({
        where: { userId, organizationId: currentUser.organizationId },
      }),
      db.stageLog.deleteMany({
        where: { operatorId: userId, organizationId: currentUser.organizationId },
      }),
      db.notificationSettings.deleteMany({
        where: { userId, organizationId: currentUser.organizationId },
      }),
      db.importBatch.deleteMany({
        where: { created_by: userId, organizationId: currentUser.organizationId },
      }),
      db.invitation.deleteMany({
        where: { invitedBy: userId, organizationId: currentUser.organizationId },
      }),
      db.saleOrder.updateMany({
        where: { createdBy: userId, organizationId: currentUser.organizationId },
        data: { createdBy: null },
      }),
      db.user.delete({
        where: { id: userId, organizationId: currentUser.organizationId },
      }),
    ]);

    const adminClient = getSupabaseAdmin();
    if (adminClient) {
      const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
      if (authError && !authError.message.toLowerCase().includes("not found")) {
        console.error("Delete auth user error:", authError.message);
      }
    }

    revalidatePath("/users");
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user.",
    };
  }
}

export async function updateUser(_prevState: unknown, maybeFormData?: FormData) {
  try {
    const currentUser = await assertAdminAccess();
    const db = getTenantPrisma(currentUser.organizationId);
    const payload = resolveFormPayload(_prevState, maybeFormData);

    const userId = getPayloadValue(payload, 'userId') as string;
    const name = getPayloadValue(payload, 'name') as string;
    const role = getPayloadValue(payload, 'role') as string;
    const branchId = getPayloadValue(payload, 'branchId') as string | null;
    const departmentsValue = String(getPayloadValue(payload, 'departments') || '');
    const departments = Array.from(new Set(
      departmentsValue.split(',').map(value => value.trim()).filter(Boolean)
    ));

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
      departments: role === 'OPERATOR' ? departments : [],
      department: role === 'OPERATOR' ? departments[0] ?? null : null,
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
