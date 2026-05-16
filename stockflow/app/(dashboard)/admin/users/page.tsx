export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/types";
import { UserRow } from "@/components/admin/UserRow";
import InviteUserModal from "@/components/admin/InviteUserModal";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  department: string | null;
};

async function getUsers() {
  try {
    // Get users from Prisma User table
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    })) as AdminUserRow[];
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [] as AdminUserRow[];
  }
}

export default async function AdminUsersPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const users = await getUsers();

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Users & Roles</h1>
          <div className="section-sub">Manage team access and department assignments</div>
        </div>
        <InviteUserModal />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
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
                <td>{user.role === 'OPERATOR' ? (user.department || '—') : '—'}</td>
                <td><span className="badge badge-green">Active</span></td>
                <td>
                  <UserRow user={user} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{textAlign: 'center', padding: '40px 20px', color: 'var(--muted)'}}>
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
                    No users found
                  </p>
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--muted)',
                    marginTop: '4px'
                  }}>
                    Invite your first team member to get started
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
