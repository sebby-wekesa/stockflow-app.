import { prisma, withRetry } from '@/lib/prisma'

export async function getSystemOrganization() {
  const organizations = await withRetry(() =>
    prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
      take: 2,
    })
  )

  if (organizations.length !== 1) {
    throw new Error(
      `Expected exactly one active organization, found ${organizations.length}`
    )
  }

  return organizations[0]
}
