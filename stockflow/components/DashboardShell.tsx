"use client";

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
  return (
    <ToastProvider>
      <div className="app">
        <Sidebar role={role} />
        <div className="main">
          <div className="topbar">
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
