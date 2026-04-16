import Link from "next/link";
import { Role } from "@/lib/auth";

const ROLES = {
  admin: {
    name: 'Admin / Owner',
    color: 'var(--accent)',
    nav: [
      { section: 'Overview' },
      { id: 'dashboard', label: 'Dashboard', badge: null },
      { section: 'Production' },
      { id: 'designs', label: 'Design templates', badge: null },
      { id: 'orders', label: 'Production orders', badge: '4' },
      { id: 'departments', label: 'Departments', badge: null },
      { section: 'Inventory' },
      { id: 'rawmaterials', label: 'Raw materials', badge: null },
      { id: 'finishedgoods', label: 'Finished goods', badge: null },
      { section: 'Sales' },
      { id: 'sales', label: 'Sales orders', badge: '2' },
      { id: 'packaging', label: 'Packaging queue', badge: null },
      { section: 'Settings' },
      { id: 'users', label: 'Users & roles', badge: null },
    ]
  },
  manager: {
    name: 'Production Manager',
    color: 'var(--accent)',
    nav: [
      { section: 'Overview' },
      { id: 'manager_dash', label: 'Dashboard', badge: null },
      { section: 'Approvals' },
      { id: 'approvals', label: 'Order approvals', badge: '3', badgeColor: 'red' },
      { section: 'Production' },
      { id: 'orders', label: 'All orders', badge: null },
      { id: 'departments', label: 'Dept queues', badge: null },
       { section: 'Reports' },
       { id: 'reports', label: 'Monthly yield report', badge: null },
       { id: 'scrap', label: 'Scrap report', badge: null },
      { id: 'rawmaterials', label: 'Raw materials', badge: null },
    ]
  },
  operator: {
    name: 'Operator — Cutting',
    color: 'var(--purple)',
    nav: [
      { section: 'My Work' },
      { id: 'operator_queue', label: 'Job queue', badge: '3', badgeColor: 'purple' },
      { id: 'operator_log', label: 'Log output', badge: null },
      { section: 'History' },
      { id: 'operator_history', label: 'Completed jobs', badge: null },
    ]
  },
  sales: {
    name: 'Sales Team',
    color: 'var(--teal)',
    nav: [
      { section: 'Catalogue' },
      { id: 'catalogue', label: 'Available stock', badge: null },
      { id: 'place_order', label: 'Place order', badge: null },
      { section: 'My Orders' },
      { id: 'my_orders', label: 'Order history', badge: null },
    ]
  },
  packaging: {
    name: 'Packaging Team',
    color: 'var(--green)',
    nav: [
      { section: 'Fulfilment' },
      { id: 'pack_queue', label: 'Pending orders', badge: '5', badgeColor: 'purple' },
      { id: 'pack_done', label: 'Fulfilled today', badge: null },
    ]
  },
  warehouse: {
    name: 'Warehouse Team',
    color: 'var(--muted)',
    nav: [
      { section: 'Receiving' },
      { id: 'receive', label: 'Receive stock', badge: null },
      { id: 'rawmaterials', label: 'Stock levels', badge: null },
    ]
  }
};

interface SidebarProps {
  role: Role;
  userName: string | null | undefined;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const roleConfig = ROLES[role];
  
  if (!roleConfig) {
    return null;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">StockFlow</div>
        <div className="logo-sub">Manufacturing Platform</div>
      </div>
      <div className="role-badge">
        <div className="role-label">Signed in as</div>
        <div className="role-name" style={{ color: roleConfig.color.replace('var(--)', '') }}>
          {roleConfig.name}
        </div>
      </div>
      <nav className="nav" id="sidebar-nav">
        {roleConfig.nav.map((item, index) => {
          if (item.section) {
            return (
              <div key={index} className="nav-section">
                {item.section}
              </div>
            );
          }
          
          const bc = item.badgeColor || '';
          const badge = item.badge ? (
            <span className={`nav-badge ${bc}`}>{item.badge}</span>
          ) : null;
          
          return (
            <Link
              key={item.id}
              href={`/${item.id}`}
              className="nav-item"
              // Note: In a real app, we'd use usePathname() to set active state
            >
              <span className="nav-dot"></span>
              {item.label}
              {badge}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}