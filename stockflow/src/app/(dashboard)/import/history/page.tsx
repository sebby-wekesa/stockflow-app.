import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

export default async function ImportHistoryPage() {
  const supabase = createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const imports = await prisma.importJob.findMany({
    where: { created_by: authUser.id },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div className="mb-6">
        <Link href="/import" className="text-sm text-muted hover:text-text">
          ← Back to import
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">Import history</h1>
        <p className="text-muted text-sm mt-1">
          View past import jobs and their status.
        </p>
      </div>

      <div className="card">
        {imports.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p>No import jobs yet.</p>
            <Link href="/import" className="text-accent hover:underline mt-2 inline-block">
              Start your first import
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {imports.map((imp) => (
              <div key={imp.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{imp.filename}</div>
                  <div className="text-sm text-muted">
                    {imp.status} · {imp.total_rows} rows · {imp.created_at.toLocaleDateString()}
                  </div>
                </div>
                <Link
                  href={`/import/${imp.id}`}
                  className="text-accent hover:underline text-sm"
                >
                  View details
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}