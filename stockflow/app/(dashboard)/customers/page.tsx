import { prisma } from '@/lib/prisma'

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
            { contactInfo: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    orderBy: { name: 'asc' },
    take: 100,
    include: { _count: { select: { saleOrders: true } } },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Customers</h1>
          <p className="text-muted text-sm mt-1">
            {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
          </p>
        </div>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or contact..."
          className="input max-w-md"
        />
      </form>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-muted text-sm">
                  {q ? 'No customers match this search.' : 'No customers yet.'}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-surface2">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-muted">{c.contactInfo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{c._count.saleOrders}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
