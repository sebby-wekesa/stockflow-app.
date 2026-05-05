import Link from 'next/link'
import type { User } from '@prisma/client'

type NavItem =
  | { type: 'section'; label: string }
  | { type: 'link'; href: string; label: string; badge?: string; comingSoon?: boolean }

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  admin: [
    { type: 'section', label: 'Overview' },
    { type: 'link', href: '/dashboard', label: 'Dashboard' },
    { type: 'section', label: 'Data import' },
    { type: 'link', href: '/import', label: 'Import centre', comingSoon: true },
    { type: 'link', href: '/import/history', label: 'Import history', comingSoon: true },
    { type: 'section', label: 'Product master' },
    { type: 'link', href: '/products', label: 'All products', comingSoon: true },
    { type: 'section', label: 'Inventory' },
    { type: 'link', href: '/stock', label: 'Branch stock', comingSoon: true },
    { type: 'link', href: '/raw-materials', label: 'Raw materials', comingSoon: true },
    { type: 'section', label: 'Sales' },
    { type: 'link', href: '/sales', label: 'Sales orders', comingSoon: true },
    { type: 'section', label: 'Settings' },
    { type: 'link', href: '/users', label: 'Users & branches', comingSoon: true },
  ],
  manager: [
    { type: 'section', label: 'Overview' },
    { type: 'link', href: '/dashboard', label: 'Dashboard' },
    { type: 'section', label: 'Approvals' },
    { type: 'link', href: '/approvals/imports', label: 'Import approvals', comingSoon: true },
    { type: 'section', label: 'Inventory' },
    { type: 'link', href: '/stock', label: 'Branch stock', comingSoon: true },
  ],
  warehouse: [
    { type: 'section', label: 'Receiving' },
    { type: 'link', href: '/dashboard', label: 'Dashboard' },
    { type: 'link', href: '/stock/receive', label: 'Receive stock', comingSoon: true },
  ],
  sales: [
    { type: 'section', label: 'Catalogue' },
    { type: 'link', href: '/dashboard', label: 'Dashboard' },
    { type: 'link', href: '/catalogue', label: 'Available stock', comingSoon: true },
  ],
  accountant: [
    { type: 'section', label: 'Reports' },
    { type: 'link', href: '/dashboard', label: 'Dashboard' },
  ],
}

export function Sidebar({ user }: { user: User }) {
  const nav = NAV_BY_ROLE[user.role] ?? NAV_BY_ROLE.admin

  return (
    <aside className="w-60 border-r border-border bg-surface flex-shrink-0 flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="font-head text-lg font-bold text-accent">StockFlow</div>
        <div className="text-xs text-muted">Springtech (K) Ltd</div>
      </div>

      <div className="px-5 py-4 border-b border-border">
        <div className="text-xs uppercase tracking-wider text-muted mb-1">Signed in as</div>
        <div className="text-sm font-medium capitalize">{user.role}</div>
        <div className="text-xs text-muted truncate mt-0.5">{user.full_name}</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {nav.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div
                key={`s-${idx}`}
                className="px-5 pt-4 pb-1 text-[10px] uppercase tracking-widest text-muted"
              >
                {item.label}
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.comingSoon ? '#' : item.href}
              className={`flex items-center justify-between px-5 py-2 text-sm hover:bg-surface2 transition-colors ${
                item.comingSoon ? 'text-muted cursor-not-allowed' : 'text-text'
              }`}
            >
              <span>{item.label}</span>
              {item.comingSoon && (
                <span className="text-[10px] uppercase tracking-wider text-muted">soon</span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
