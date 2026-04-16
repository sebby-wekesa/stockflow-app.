"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { Role } from "@/lib/auth";

export function DashboardShell({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const role = user.role as Role;
  const [previewRole, setPreviewRole] = useState<Role>(role);

  // Handle role switching (for preview purposes)
  useEffect(() => {
    setPreviewRole(role);
  }, [role]);

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar user={{ role: previewRole, name: user.name || '' }} />
        <div className="main">
          <div className="topbar">
            <span style={{fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px'}}>Preview role:</span>
            <div className="topbar-role-switcher">
              <button
                className={`role-btn ${previewRole === "ADMIN" ? "active" : ""}`}
                onClick={() => setPreviewRole("ADMIN")}
              >
                Admin
              </button>
              <button
                className={`role-btn ${previewRole === "MANAGER" ? "active" : ""}`}
                onClick={() => setPreviewRole("MANAGER")}
              >
                Manager
              </button>
              <button
                className={`role-btn ${previewRole === "OPERATOR" ? "active" : ""}`}
                onClick={() => setPreviewRole("OPERATOR")}
              >
                Operator
              </button>
              <button
                className={`role-btn ${previewRole === "SALES" ? "active" : ""}`}
                onClick={() => setPreviewRole("SALES")}
              >
                Sales
              </button>
              <button
                className={`role-btn ${previewRole === "PACKAGING" ? "active" : ""}`}
                onClick={() => setPreviewRole("PACKAGING")}
              >
                Packaging
              </button>
              <button
                className={`role-btn ${previewRole === "WAREHOUSE" ? "active" : ""}`}
                onClick={() => setPreviewRole("WAREHOUSE")}
              >
                Warehouse
              </button>
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
