import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@/lib/auth";

const roleColors: Record<Role, string> = {
  ADMIN: "var(--accent)",
  MANAGER: "var(--accent)",
  OPERATOR: "var(--purple)",
  SALES: "var(--teal)",
  PACKAGING: "var(--green)",
  WAREHOUSE: "var(--muted)",
};

const roleNames: Record<Role, string> = {
  ADMIN: "Admin / Owner",
  MANAGER: "Production Manager",
  OPERATOR: "Operator", // will be overridden
  SALES: "Sales Team",
  PACKAGING: "Packaging Team",
  WAREHOUSE: "Warehouse Team",
};

const roleNavItems: Record<Role, any[]> = {
  ADMIN: [
    { section: "Overview" },
    { label: "Dashboard", href: "/dashboard" },
    { section: "Production" },
    { label: "Design templates", href: "/designs" },
    { label: "Production orders", href: "/orders", badge: "4" },
    { label: "Departments", href: "/departments" },
    { section: "Inventory" },
    { label: "Raw materials", href: "/rawmaterials" },
    { label: "Finished goods", href: "/finishedgoods" },
    { section: "Sales" },
    { label: "Sales orders", href: "/sales", badge: "2" },
    { label: "Packaging queue", href: "/packaging" },
    { section: "Settings" },
    { label: "Users & roles", href: "/users" },
  ],
  MANAGER: [
    { section: "Overview" },
    { label: "Dashboard", href: "/manager_dash" },
    { section: "Approvals" },
    { label: "Order approvals", href: "/approvals", badge: "3", badgeColor: "red" },
    { section: "Production" },
    { label: "All orders", href: "/orders" },
    { label: "Dept queues", href: "/departments" },
    { section: "Reports" },
    { label: "Scrap report", href: "/scrap" },
    { label: "Raw materials", href: "/rawmaterials" },
  ],
  OPERATOR: [
    { section: "My Work" },
    { label: "Job queue", href: "/operator_queue", badge: "3", badgeColor: "purple" },
    { label: "Log output", href: "/operator_log" },
    { section: "History" },
    { label: "Completed jobs", href: "/operator_history" },
  ],
  SALES: [
    { section: "Catalogue" },
    { label: "Available stock", href: "/catalogue" },
    { label: "Place order", href: "/place_order" },
    { section: "My Orders" },
    { label: "Order history", href: "/my_orders" },
  ],
  PACKAGING: [
    { section: "Fulfilment" },
    { label: "Pending orders", href: "/pack_queue", badge: "5", badgeColor: "purple" },
    { label: "Fulfilled today", href: "/pack_done" },
  ],
  WAREHOUSE: [
    { section: "Receiving" },
    { label: "Receive stock", href: "/receive" },
    { label: "Stock levels", href: "/rawmaterials" },
  ],
};

export function Sidebar({ user }: { user: { role: Role, name: string, department?: string } }) {
  const pathname = usePathname();
  const navItems = roleNavItems[user.role];
  const roleColor = roleColors[user.role];
  const roleNameDisplay = user.role === 'OPERATOR' && user.department ? `Operator — ${user.department}` : roleNames[user.role];

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
      </nav>
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
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