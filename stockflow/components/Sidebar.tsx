import { Role } from "@/lib/auth";

const roleColors: Record<string, string> = {
  admin: "var(--accent)",
  manager: "var(--accent)",
  operator: "var(--purple)",
  sales: "var(--teal)",
  packaging: "var(--green)",
  warehouse: "var(--muted)",
};

const roleNames: Record<string, string> = {
  admin: "Admin / Owner",
  manager: "Production Manager",
  operator: "Operator — Cutting",
  sales: "Sales Team",
  packaging: "Packaging Team",
  warehouse: "Warehouse Team",
};

const roleNavItems: Record<string, any[]> = {
  admin: [
    { section: "Overview" },
    { id: 'dashboard', label: 'Dashboard' },
    { section: "Production" },
    { id: 'designs', label: 'Design templates' },
    { id: 'orders', label: 'Production orders', badge: "4" },
    { id: 'departments', label: 'Departments' },
    { section: "Inventory" },
    { id: 'rawmaterials', label: 'Raw materials' },
    { id: 'finishedgoods', label: 'Finished goods' },
    { section: "Sales" },
    { id: 'sales', label: 'Sales orders', badge: "2" },
    { id: 'packaging', label: 'Packaging queue' },
    { section: "Settings" },
    { id: 'users', label: 'Users & roles' },
  ],
  manager: [
    { section: "Overview" },
    { id: 'manager_dash', label: 'Dashboard' },
    { section: "Approvals" },
    { id: 'approvals', label: 'Order approvals', badge: "3", badgeColor: "red" },
    { section: "Production" },
    { id: 'orders', label: 'All orders' },
    { id: 'departments', label: 'Dept queues' },
    { section: "Reports" },
    { id: 'scrap', label: 'Scrap report' },
    { id: 'rawmaterials', label: 'Raw materials' },
  ],
  operator: [
    { section: "My Work" },
    { id: 'operator_queue', label: 'Job queue', badge: "3", badgeColor: "purple" },
    { id: 'operator_log', label: 'Log output' },
    { section: "History" },
    { id: 'operator_history', label: 'Completed jobs' },
  ],
  sales: [
    { section: "Catalogue" },
    { id: 'catalogue', label: 'Available stock' },
    { id: 'place_order', label: 'Place order' },
    { section: "My Orders" },
    { id: 'my_orders', label: 'Order history' },
  ],
  packaging: [
    { section: "Fulfilment" },
    { id: 'pack_queue', label: 'Pending orders', badge: "5", badgeColor: "purple" },
    { id: 'pack_done', label: 'Fulfilled today' },
  ],
  warehouse: [
    { section: "Receiving" },
    { id: 'receive', label: 'Receive stock' },
    { id: 'rawmaterials', label: 'Stock levels' },
  ],
};

interface SidebarProps {
  currentRole: string;
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export function Sidebar({ currentRole, currentScreen, onNavigate }: SidebarProps) {
  const navItems = roleNavItems[currentRole];
  const roleColor = roleColors[currentRole];
  const roleName = roleNames[currentRole];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">StockFlow</div>
        <div className="logo-sub">Manufacturing Platform</div>
      </div>
      <div className="role-badge">
        <div className="role-label">Signed in as</div>
        <div className="role-name" style={{ color: roleColor }}>
          {roleName}
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

          const isActive = currentScreen === item.id;
          const bc = item.badgeColor ? ` ${item.badgeColor}` : "";
          const badge = item.badge ? <span className={`nav-badge${bc}`}>{item.badge}</span> : null;

          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-dot"></span>
              {item.label}
              {badge}
            </div>
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