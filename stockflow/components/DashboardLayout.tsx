'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { DashboardContent } from '@/components/DashboardContent';

const ROLES = {
  admin: { name: 'Admin / Owner', color: 'var(--accent)' },
  manager: { name: 'Production Manager', color: 'var(--accent)' },
  operator: { name: 'Operator — Cutting', color: 'var(--purple)' },
  sales: { name: 'Sales Team', color: 'var(--teal)' },
  packaging: { name: 'Packaging Team', color: 'var(--green)' },
  warehouse: { name: 'Warehouse Team', color: 'var(--muted)' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState('admin');
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  const switchRole = (role: string) => {
    setCurrentRole(role);
    setCurrentScreen('dashboard'); // Reset to dashboard when switching roles
  };

  const navigate = (screen: string) => {
    setCurrentScreen(screen);
  };

  return (
    <div className="app">
      <Sidebar
        currentRole={currentRole}
        currentScreen={currentScreen}
        onNavigate={navigate}
      />
      <div className="main">
        <Topbar
          currentRole={currentRole}
          onRoleSwitch={switchRole}
        />
        <div className="content">
          <DashboardContent
            currentRole={currentRole}
            currentScreen={currentScreen}
          />
        </div>
      </div>
    </div>
  );
}