"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole as Role } from "@/lib/types";
import type { UserRole } from "@/lib/types";
import { ROLE_NAMES, ROLE_COLORS } from "@/lib/types";
import { signOut } from "@/actions/auth";

type SidebarCounts = {
  operatorQueue?: number
  packagingQueue?: number
}

type NavItem = {
  section?: string
  label?: string
  href?: string
  badge?: string
  badgeColor?: string
}

// Generate role-specific navigation items
function getRoleNavItems(role: UserRole, counts: SidebarCounts = {}): NavItem[] {
  // Common navigation for all roles
  const commonItems = [
    { section: "Account" },
    { label: "Profile", href: "/profile" },
    { label: "Settings", href: "/settings" },
  ];

  // Role-specific navigation
  switch (role) {
    case 'PENDING':
      return [
        { section: "Account Setup" },
        { label: "Complete profile", href: "/profile" },
      ];

    case 'ADMIN':
      return [
        { section: "Overview" },
        { label: "Dashboard", href: "/dashboard" },
        { section: "Production" },
        { label: "Job cards", href: "/jobs" },
        { label: "Design", href: "/designs" },
        { label: "Raw materials", href: "/rawmaterials" },
        { section: "Inventory" },
        { label: "Stock overview", href: "/stock" },
        { label: "Products", href: "/products" },
        { section: "Sales" },
        { label: "Sales orders", href: "/sales" },
        { label: "Customers", href: "/customers" },
        { section: "Data" },
        { label: "Import centre", href: "/import" },
        { label: "Reports", href: "/reports" },
        { section: "Settings" },
        { label: "Users", href: "/users" },
      ];

    case 'MANAGER':
      return [
        { section: "Overview" },
        { label: "Dashboard", href: "/dashboard" },
        { section: "Production" },
        { label: "Job cards", href: "/jobs" },
        { label: "Design", href: "/designs" },
        { label: "Raw materials", href: "/rawmaterials" },
        { section: "Inventory" },
        { label: "Stock overview", href: "/stock" },
        { section: "Sales" },
        { label: "New order", href: "/sales/new" },
        { label: "Sales orders", href: "/sales" },
        { section: "Reports" },
        { label: "Reports", href: "/reports" },
      ];

    case 'OPERATOR':
      return [
        { section: "My Work" },
        {
          label: "Job queue",
          href: "/operator_queue",
          badge: counts.operatorQueue && counts.operatorQueue > 0 ? String(counts.operatorQueue) : undefined,
          badgeColor: "purple",
        },
        { section: "History" },
        { label: "Completed jobs", href: "/operator_history" },
      ];

    case 'SALES':
      return [
        { section: "Sales" },
        { label: "New order", href: "/sales/new" },
        { label: "Order history", href: "/sales" },
        { section: "Catalogue" },
        { label: "Available stock", href: "/catalogue" },
      ];

    case 'PACKAGING':
      return [
        { section: "Fulfilment" },
        {
          label: "Pending orders",
          href: "/packaging",
          badge: counts.packagingQueue && counts.packagingQueue > 0 ? String(counts.packagingQueue) : undefined,
          badgeColor: "purple",
        },
        { label: "Fulfilled today", href: "/pack_done" },
      ];

    case 'WAREHOUSE':
      return [
        { section: "Overview" },
        { label: "Dashboard", href: "/dashboard" },
        { section: "Production" },
        { label: "Job cards", href: "/jobs" },
        { section: "Raw Materials" },
        { label: "Raw materials", href: "/rawmaterials" },
        { label: "Receive stock", href: "/receive" },
        { section: "Inventory" },
        { label: "Stock overview", href: "/stock" },
      ];

    default:
      return commonItems;
  }
}

export function Sidebar({ role, counts = {} }: { role: UserRole; counts?: SidebarCounts }) {
  const pathname = usePathname();
  const navItems = getRoleNavItems(role, counts);
  const roleColor = ROLE_COLORS[role];
  const roleNameDisplay = ROLE_NAMES[role];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">StockFlow</div>
        <div className="logo-sub">Manufacturing Platform</div>
      </div>
      <div className="role-badge">
        <div className="role-label">Signed in as</div>
        <div className="role-name" style={{ color: roleColor }}>
          {roleNameDisplay}
        </div>
      </div>
      <nav className="nav">
        {navItems.map((item, i) => {
          if (item.section) {
            return (
              <div key={`section-${i}`} className="nav-section">
                {item.section}
              </div>
            );
          }

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const bc = item.badgeColor ? ` ${item.badgeColor}` : "";
          const badge = item.badge ? <span className={`nav-badge${bc}`}>{item.badge}</span> : null;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-dot"></span>
              {item.label}
              {badge}
            </Link>
          );
        })}
        
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <form action={signOut} style={{ display: 'block', width: '100%' }}>
            <button
              type="submit"
              className="bg-[#f0c040] hover:bg-[#f5d060] text-black"
              style={{ width: '100%', padding: '8px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginTop: '20px' }}
            >
              Log out
            </button>
          </form>
        </div>
      </nav>
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    PENDING: "badge-muted",
    ADMIN: "badge-amber",
    MANAGER: "badge-amber",
    OPERATOR: "badge-purple",
    SALES: "badge-teal",
    PACKAGING: "badge-green",
    WAREHOUSE: "badge-muted",
  };

  return (
    <span className={`badge ${colors[role]}`}>
      {role}
    </span>
  );
}
