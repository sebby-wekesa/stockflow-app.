export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireActiveAuth } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import type { UserRole } from "@/lib/types";
import { AuthOnlyUserRow, UserRow } from "@/components/admin/UserRow";
import InviteUserModal from "@/components/admin/InviteUserModal";
import { isUserOnline } from "@/lib/presence";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import { BRANCH_LABELS } from "@/lib/branches";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  department: string | null;
  departments: string[];
  lastSeenAt: Date | null;
  isVerified: boolean;
  authMissing: boolean;
  branchId: string | null;
  Branch: { code: string } | null;
};

type AuthOnlyUser = {
  id: string;
  email: string;
  name: string | null;
  isVerified: boolean;
  createdAt: string | null;
  linkStatus: "UNLINKED" | "LINKED_ELSEWHERE";
  organizationName: string | null;
};

async function getUsers(query: string) {
  try {
    const user = await requireActiveAuth();
    const db = getTenantPrisma(user.organizationId);

    // Get users from Prisma User table (tenant scoped)
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        departments: true,
        lastSeenAt: true,
        branchId: true,
        Branch: {
          select: {
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const supabaseAdmin = getSupabaseAdmin();
    const authUsers = supabaseAdmin
      ? await Promise.all(
          users.map(async (user) => {
            const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.id);
            if (error) {
              if (!error.message.toLowerCase().includes("not found")) {
                console.error(`Failed to fetch auth user ${user.id}:`, error.message);
              }
              return [user.id, null] as const;
            }
            return [user.id, data.user] as const;
          })
        )
      : [];
    const authUsersById = new Map(authUsers);

    const enrichedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      departments: user.departments,
      lastSeenAt: user.lastSeenAt,
      isVerified: Boolean(authUsersById.get(user.id)?.email_confirmed_at),
      authMissing: Boolean(supabaseAdmin && !authUsersById.get(user.id)),
      branchId: user.branchId,
      Branch: user.Branch,
    })) as AdminUserRow[];

    if (!query) return enrichedUsers;

    const normalizedQuery = query.toLowerCase();

    return enrichedUsers.filter((user) => {
      const status = [
        user.authMissing ? "missing auth" : user.isVerified ? "verified" : "unverified",
        isUserOnline(user.lastSeenAt) ? "online" : "offline",
      ];
      const branch = user.Branch
        ? BRANCH_LABELS[user.Branch.code as keyof typeof BRANCH_LABELS] || user.Branch.code
        : "no branch";

      return [
        user.name || "unnamed user",
        user.email,
        user.role,
        user.departments.join(" "),
        branch,
        ...status,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [] as AdminUserRow[];
  }
}

async function getAuthOnlyUsers(): Promise<AuthOnlyUser[]> {
  try {
    const currentUser = await requireActiveAuth();
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) return [];

    const appUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        organizationId: true,
        Organization: {
          select: { name: true },
        },
      },
    });
    const currentOrgUserIds = new Set(
      appUsers.filter((user) => user.organizationId === currentUser.organizationId).map((user) => user.id)
    );
    const currentOrgUserEmails = new Set(
      appUsers
        .filter((user) => user.organizationId === currentUser.organizationId)
        .map((user) => user.email.toLowerCase())
    );
    const appUserById = new Map(appUsers.map((user) => [user.id, user]));
    const appUserByEmail = new Map(appUsers.map((user) => [user.email.toLowerCase(), user]));

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error("Failed to fetch Supabase auth users:", error.message);
      return [];
    }

    return data.users
      .filter((authUser) => {
        const email = authUser.email?.toLowerCase();
        return !currentOrgUserIds.has(authUser.id) && (!email || !currentOrgUserEmails.has(email));
      })
      .map((authUser) => ({
        authUser,
        appUser: appUserById.get(authUser.id) ?? (authUser.email ? appUserByEmail.get(authUser.email.toLowerCase()) : null),
      }))
      .map(({ authUser, appUser }) => {
        const linkedElsewhere = Boolean(appUser?.organizationId && appUser.organizationId !== currentUser.organizationId);

        return {
          id: authUser.id,
          email: authUser.email ?? "No email",
          name:
            typeof authUser.user_metadata?.name === "string"
              ? authUser.user_metadata.name
              : typeof authUser.user_metadata?.full_name === "string"
                ? authUser.user_metadata.full_name
                : null,
          isVerified: Boolean(authUser.email_confirmed_at),
          createdAt: authUser.created_at ?? null,
          linkStatus: linkedElsewhere ? "LINKED_ELSEWHERE" : "UNLINKED",
          organizationName: linkedElsewhere ? appUser?.Organization?.name ?? "Another organization" : null,
        };
      });
  } catch (error) {
    console.error("Failed to fetch unlinked auth users:", error);
    return [];
  }
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const user = await requireActiveAuth();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const users = await getUsers(query);
  const authOnlyUsers = await getAuthOnlyUsers();

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Users & Roles</h1>
          <div className="section-sub">Manage team access and department assignments</div>
        </div>
        <InviteUserModal />
      </div>

      <form action="/users" className="card mb-16" style={{ display: "flex", gap: "12px", alignItems: "end" }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label" htmlFor="user-search">Search users</label>
          <input
            id="user-search"
            name="q"
            type="search"
            className="form-input"
            defaultValue={query}
            placeholder="Search by name, email, role, branch, department, or status"
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
        {query && <Link href="/users" className="btn btn-ghost">Clear</Link>}
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || 'Unnamed User'}</td>
                <td style={{color:'var(--muted)'}}>{user.email}</td>
                <td>
                  <span className={`badge ${
                    ['ADMIN', 'MANAGER'].includes(user.role) ? 'badge-amber' :
                    user.role === 'OPERATOR' ? 'badge-purple' :
                    user.role === 'SALES' ? 'badge-teal' :
                    'badge-muted'
                  }`}>
                    {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                  </span>
                </td>
                <td>
                  {user.Branch ? (
                    <span className="badge badge-outline badge-sm">
                      {BRANCH_LABELS[user.Branch.code as keyof typeof BRANCH_LABELS] || user.Branch.code}
                    </span>
                  ) : (
                    <span className="badge badge-ghost badge-sm">No branch</span>
                  )}
                </td>
                <td>{user.role === 'OPERATOR' ? (user.departments.join(', ') || user.department || '—') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span className={`badge ${user.isVerified ? 'badge-green' : 'badge-amber'}`}>
                      {user.authMissing ? 'Missing auth' : user.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                    {isUserOnline(user.lastSeenAt) ? (
                      <span className="badge badge-green flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                        Online
                      </span>
                    ) : (
                      <span className="badge badge-muted">Offline</span>
                    )}
                  </div>
                </td>
                <td>
                  <UserRow user={user} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} style={{textAlign: 'center', padding: '40px 20px', color: 'var(--muted)'}}>
                  <div style={{
                    display: 'inline-block',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      padding: '16px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border2)',
                      borderRadius: 'var(--radius)',
                      display: 'inline-block'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--muted)',
                    margin: '0'
                  }}>
                    {query ? `No users match "${query}"` : "No users found"}
                  </p>
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--muted)',
                    marginTop: '4px'
                  }}>
                    {query ? "Try a different search term" : "Invite your first team member to get started"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {authOnlyUsers.length > 0 && (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Supabase Auth users not in this organization</h2>
            <div className="section-sub">
              These accounts exist in Supabase Auth but are either unlinked or linked to a different organization.
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>App link</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {authOnlyUsers.map((authUser) => (
                  <tr key={authUser.id}>
                    <td>{authUser.name || 'Unnamed User'}</td>
                    <td style={{ color: 'var(--muted)' }}>{authUser.email}</td>
                    <td>
                      <span className={`badge ${authUser.isVerified ? 'badge-green' : 'badge-amber'}`}>
                        {authUser.isVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td>
                      {authUser.linkStatus === "UNLINKED" ? (
                        <span className="badge badge-amber">Unlinked</span>
                      ) : (
                        <span className="badge badge-muted">
                          {authUser.organizationName}
                        </span>
                      )}
                    </td>
                    <td>
                      {authUser.createdAt ? new Date(authUser.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <AuthOnlyUserRow user={authUser} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
