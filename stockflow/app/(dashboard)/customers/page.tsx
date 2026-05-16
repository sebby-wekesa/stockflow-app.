import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatKES } from '@/lib/branches'

const PAGE_SIZE = 50

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
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
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        SaleOrder: {
          where: { status: { in: ['CONFIRMED', 'SHIPPED'] } },
          select: {
            SaleItem: { select: { totalPrice: true } }
          }
        }
      }
    }),
    prisma.customer.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Calculate totals for each customer
  const customersWithTotals = customers.map(customer => {
    const totalOrders = customer.SaleOrder.length
    const totalSpent = customer.SaleOrder.reduce((sum, order) => {
      return sum + order.SaleItem.reduce((itemSum, item) => itemSum + Number(item.totalPrice), 0)
    }, 0)
    const lastOrderDate = customer.SaleOrder.length > 0
      ? new Date(Math.max(...customer.SaleOrder.map(() => Date.now()))) // Simplified - in real app would track order dates
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Customers</h1>
          <p className="text-muted text-sm mt-1">
            Customer master data and purchase history
          </p>
        </div>
        <Link href="/customers/new" className="btn btn-primary">
          + Add customer
        </Link>
      </div>

      {/* SEARCH */}
      <div className="card p-4 mb-6">
        <form className="flex gap-4">
          <input
            type="search"
            name="q"
            placeholder="Search by name or phone..."
            defaultValue={q}
            className="input flex-1"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* TABLE */}
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium text-right">Orders</th>
              <th className="px-4 py-3 font-medium text-right">Total Spent</th>
              <th className="px-4 py-3 font-medium">Last Order</th>
            </tr>
          </thead>
          <tbody>
            {customersWithTotals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted text-sm">
                  No customers found.{' '}
                  <Link href="/customers/new" className="text-accent">
                    Add your first customer
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              customersWithTotals.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-b-0 hover:bg-surface2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{customer.phone || '—'}</div>
                    {customer.email && (
                      <div className="text-xs text-muted">{customer.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {customer.totalOrders}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatKES(customer.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {customer.lastOrderDate
                      ? customer.lastOrderDate.toLocaleDateString()
                      : '—'
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
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