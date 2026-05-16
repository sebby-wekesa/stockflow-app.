import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ImportWorkflow } from './_components/ImportWorkflow'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ImportDetailPage({ params }: PageProps) {
  const { id } = await params

  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: {
      created_by_user: { select: { name: true } },
      rows: {
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