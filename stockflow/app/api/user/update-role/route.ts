export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAuth } from '@/lib/auth';
import { getTenantPrisma } from '@/lib/tenant-prisma';
import { USER_ROLES, type UserRole } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireActiveAuth();

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getTenantPrisma(currentUser.organizationId);

    const { userId, role } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (typeof role !== "string") {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Validate role is a valid UserRole
    if (!(USER_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Update role (tenant-scoped)
    await db.user.update({
      where: { id: userId, organizationId: currentUser.organizationId },
      data: { role: role as UserRole },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
