import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BRANCH_LABELS } from '@/lib/branches'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const q = searchParams.q?.trim() ?? ''

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    orderBy: { name: 'asc' },
    take: 100,
    include: { _count: { select: { sales_orders: true } } },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Customers</h1>
          <p className="text-muted text-sm mt-1">
            {customers.length} {customers.length === 1 ? 'customer' : 'customers'} · walk-ins are not stored
          </p>
        </div>
        <Link href="/customers/new" className="btn btn-primary">
          + Add customer
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, phone, or email..."
          className="input max-w-md"
        />
      </form>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted text-sm">
                  {q ? (
                    <>No customers match "{q}". <Link href="/customers" className="text-accent">Clear</Link></>
                  ) : (
                    <>No customers yet. <Link href="/customers/new" className="text-accent">Add your first</Link>.</>
                  )}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-surface2">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted font-mono">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {c.branch ? BRANCH_LABELS[c.branch] : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{c._count.sales_orders}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
