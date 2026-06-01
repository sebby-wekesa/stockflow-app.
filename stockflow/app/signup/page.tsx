import { prisma } from '@/lib/prisma'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const organizations = await prisma.organization.findMany({
    where: {
      status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  })

  return <SignupForm organizations={organizations} />
}
