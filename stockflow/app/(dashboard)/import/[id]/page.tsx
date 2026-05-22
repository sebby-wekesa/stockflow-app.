import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { ImportWorkflow } from './_components/ImportWorkflow'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ImportDetailPage({ params }: PageProps) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const db = getTenantPrisma(user.organizationId)

  const batch = await db.importBatch.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      User: { select: { name: true } },
      ImportRow: {
        orderBy: { row_number: 'asc' },
        take: 10, // For preview
      },
    },
  })

  if (!batch) {
    notFound()
  }

  return <ImportWorkflow batch={batch} />
}