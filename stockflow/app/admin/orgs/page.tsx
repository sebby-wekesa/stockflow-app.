import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma' // Intentionally raw - super-admin cross-org view
import { getUser } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/super-admin'
import { OrgActions } from './_components/OrgActions'

export default async function AdminOrgsPage() {
  const user = await getUser()
  if (!isSuperAdmin(user)) {
    redirect('/dashboard')
  }

  // Read across all orgs — super-admin scope
  const orgs = await prisma.organization.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      User: {
        where: { role: 'ADMIN' },
        select: { id: true, email: true, name: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
      _count: {
        select: {
          User: true,
          products: true,
          saleOrders: true,
        },
      },
    },
  })

  const pending = orgs.filter((o) => o.status === 'PENDING_APPROVAL')
  const active = orgs.filter((o) => o.status === 'ACTIVE')
  const suspended = orgs.filter((o) => o.status === 'SUSPENDED')
  const closed = orgs.filter((o) => o.status === 'CLOSED')

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="font-head text-2xl font-bold">Organizations</h1>
        <p className="text-muted text-sm mt-1">
          Approve, suspend, or reject tenant signups.{' '}
          <span className="text-text font-medium">Super admin only.</span>
        </p>
      </div>

      {/* PENDING APPROVAL */}
      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="font-head text-lg font-bold mb-3 text-accent">
            Awaiting your approval ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </div>
        </section>
      )}

      {/* ACTIVE */}
      <section className="mb-10">
        <h2 className="font-head text-lg font-bold mb-3">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-muted text-sm italic">No active organizations.</p>
        ) : (
          <div className="space-y-3">
            {active.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </div>
        )}
      </section>

      {/* SUSPENDED */}
      {suspended.length > 0 && (
        <section className="mb-10">
          <h2 className="font-head text-lg font-bold mb-3 text-red-400">
            Suspended ({suspended.length})
          </h2>
          <div className="space-y-3">
            {suspended.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </div>
        </section>
      )}

      {/* CLOSED */}
      {closed.length > 0 && (
        <section className="mb-10">
          <h2 className="font-head text-lg font-bold mb-3 text-muted">
            Closed ({closed.length})
          </h2>
          <div className="space-y-3">
            {closed.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function OrgCard({ org }: { org: any }) {
  const owner = org.User[0]
  const statusBadge = {
    PENDING_APPROVAL: 'bg-accent/15 text-accent',
    ACTIVE: 'bg-teal/15 text-teal',
    SUSPENDED: 'bg-red-500/15 text-red-400',
    CLOSED: 'bg-muted/15 text-muted',
  }[org.status as string] ?? 'bg-muted/15 text-muted'

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-head font-bold text-lg">{org.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge}`}>
              {org.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-xs text-muted">{org.slug}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
            <div>
              <div className="text-muted">Owner</div>
              <div className="truncate font-mono">{owner?.email ?? '—'}</div>
              {owner?.name && <div className="text-muted">{owner.name}</div>}
            </div>
            <div>
              <div className="text-muted">Signed up</div>
              <div>{new Date(org.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-muted">Users · Products · Sales</div>
              <div className="font-mono">
                {org._count.User} · {org._count.Product} · {org._count.SaleOrder}
              </div>
            </div>
            {org.disabledReason && (
              <div className="col-span-2 md:col-span-4">
                <div className="text-muted">Reason</div>
                <div className="text-red-400 italic">{org.disabledReason}</div>
              </div>
            )}
            {org.phone && (
              <div>
                <div className="text-muted">Phone</div>
                <div className="font-mono">{org.phone}</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <OrgActions orgId={org.id} status={org.status} orgName={org.name} />
        </div>
      </div>
    </div>
  )
}
