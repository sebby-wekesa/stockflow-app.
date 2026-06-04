import Link from 'next/link'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { formatKES } from '@/lib/branches'
import { EditCustomerButton } from './_components/EditCustomerButton'

const PAGE_SIZE = 50

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1))

  const where: any = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ]
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        SaleOrder: {
          where: { status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] } },
          select: {
            createdAt: true,
            SaleItem: { select: { totalPrice: true } }
          }
        }
      }
    }),
    db.customer.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Calculate totals for each customer
  const customersWithTotals = customers.map(customer => {
    const totalOrders = customer.SaleOrder.length
    const totalSpent = customer.SaleOrder.reduce((sum, order) => {
      return sum + order.SaleItem.reduce((itemSum, item) => itemSum + Number(item.totalPrice), 0)
    }, 0)
    const lastOrderDate = customer.SaleOrder.length > 0
      ? new Date(Math.max(...customer.SaleOrder.map(order => order.createdAt.getTime())))
      : null

    return {
      ...customer,
      totalOrders,
      totalSpent,
      lastOrderDate,
    }
  })

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Customers</div>
          <div className="section-sub">
            Customer master data and purchase history
          </div>
        </div>
        <Link href="/customers/new" className="btn btn-primary">
          + Add customer
        </Link>
      </div>

      {/* SEARCH */}
      <div className="card mb-16">
        <form className="flex gap-4 items-end">
          <div className="form-group flex-1">
            <label className="form-label">Search customers</label>
            <input
              type="search"
              name="q"
              placeholder="Search by name or phone..."
              defaultValue={q}
              className="form-input"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {q && <Link href="/customers" className="btn btn-ghost">Clear</Link>}
        </form>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact person</th>
              <th>Phone & email</th>
              <th>Orders</th>
              <th>Total spent</th>
              <th>Last order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customersWithTotals.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted text-sm">
                  No customers found.{' '}
                  <Link href="/customers/new" className="text-accent">
                    Add your first customer
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              customersWithTotals.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium text-accent-amber hover:underline"
                    >
                      {customer.name}
                    </Link>
                    <div className="text-xs text-muted font-mono">{customer.code}</div>
                  </td>
                  <td>{customer.contactName || '—'}</td>
                  <td>
                    <div className="text-sm">{customer.phone || '—'}</div>
                    {customer.email && (
                      <div className="text-xs text-muted">{customer.email}</div>
                    )}
                  </td>
                  <td className="font-mono">
                    {customer.totalOrders}
                  </td>
                  <td className="font-mono">
                    {formatKES(customer.totalSpent)}
                  </td>
                  <td className="text-muted">
                    {customer.lastOrderDate
                      ? customer.lastOrderDate.toLocaleDateString()
                      : '—'
                    }
                  </td>
                  <td>
                    <EditCustomerButton customer={customer} compact />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-muted">
              Showing {customers.length} of {total} customers
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/customers?${new URLSearchParams({ q, page: String(page - 1) })}`}
                  className="btn btn-sm btn-ghost"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/customers?${new URLSearchParams({ q, page: String(page + 1) })}`}
                  className="btn btn-sm btn-ghost"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
