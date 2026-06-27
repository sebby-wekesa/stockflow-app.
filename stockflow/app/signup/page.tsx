import { prisma, withRetry } from '@/lib/prisma'
import { getSystemOrganization } from '@/lib/system-organization'
import { BRANCH_LABELS, normalizeBranchCode } from '@/lib/branches'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const organization = await getSystemOrganization()
  const branches = await withRetry(() =>
    prisma.branch.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    })
  )

  return (
    <SignupForm
      organizationName={organization.name}
      branches={branches.map((branch) => {
        const branchCode = normalizeBranchCode(branch.code, branch.name)

        return {
          ...branch,
          name: branchCode === 'bonje' ? BRANCH_LABELS.bonje : branch.name,
        }
      })}
    />
  )
}
