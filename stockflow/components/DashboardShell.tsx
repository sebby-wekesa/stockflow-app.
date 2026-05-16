"use client";

import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import type { UserRole as Role } from "@/lib/types";

interface User {
  name?: string;
}

export function DashboardShell({
  user,
  role,
  children,
}: {
  user: User;
  role: Role;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const previewRoleParam = searchParams.get('previewRole') as Role;
  const previewRole = previewRoleParam || role;

  const handleRoleSwitch = (newRole: Role) => {
    // Update URL with preview role
    const url = new URL(window.location.href);
    url.searchParams.set('previewRole', newRole);
    window.location.href = url.toString();
  };

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar role={previewRole} />
        <div className="main">
          <div className="topbar">
            <span style={{fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px'}}>Preview role:</span>
            <div className="topbar-role-switcher">
              {role === "ADMIN" && (
                <button
                  className={`role-btn ${previewRole === "ADMIN" ? "active" : ""}`}
                  onClick={() => handleRoleSwitch("ADMIN")}
                >
                  Admin
                </button>
              )}
              {role === "MANAGER" && (
                <button
                  className={`role-btn ${previewRole === "MANAGER" ? "active" : ""}`}
                  onClick={() => handleRoleSwitch("MANAGER")}
                >
                  Manager
                </button>
              )}
              {role === "OPERATOR" && (
                <button
                  className={`role-btn ${previewRole === "OPERATOR" ? "active" : ""}`}
                  onClick={() => handleRoleSwitch("OPERATOR")}
                >
                  Operator
                </button>
              )}
              {role === "SALES" && (
                <button
                  className={`role-btn ${previewRole === "SALES" ? "active" : ""}`}
                  onClick={() => handleRoleSwitch("SALES")}
                >
                  Sales
                </button>
              )}
              {role === "PACKAGING" && (
                <button
                  className={`role-btn ${previewRole === "PACKAGING" ? "active" : ""}`}
                  onClick={() => handleRoleSwitch("PACKAGING")}
                >
                  Packaging
                </button>
              )}
              {role === "WAREHOUSE" && (
                <button
                  className={`role-btn ${previewRole === "WAREHOUSE" ? "active" : ""}`}
                  onClick={() => handleRoleSwitch("WAREHOUSE")}
                >
                  Warehouse
                </button>
              )}
            </div>
            <div className="topbar-right">
              <div className="notif-dot pulse"></div>
              <div className="avatar">
                {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
              </div>
            </div>
          </div>
          <div className="content">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
