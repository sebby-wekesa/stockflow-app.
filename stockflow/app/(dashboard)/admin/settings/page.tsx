import InviteUserModal from "@/components/admin/InviteUserModal";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="section-title">User Management</h1>
        </div>
        {/* Replace your old button with this */}
        <InviteUserModal />
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Settings & Configuration</h2>
        <p className="text-muted">
          This page allows you to manage users and platform-wide settings.
        </p>
      </div>
    </>
  );
}
