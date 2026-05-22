import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

export default async function OnboardingPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // If the org already has branches AND products, onboarding is done
  const [branchCount, productCount] = await Promise.all([
    db.branch.count(),
    db.product.count(),
  ])

  if (branchCount > 0 && productCount > 0) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="font-head text-3xl font-bold mb-2">
          Welcome to StockFlow, {user.name}
        </h1>
        <p className="text-muted">
          Let&apos;s get {user.organization.name} set up. Three quick steps:
        </p>
      </div>

      <div className="space-y-4">
        {/* Step 1: Branches */}
        <div
          className={`card p-5 ${branchCount > 0 ? 'opacity-60' : 'border-accent/40'}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                branchCount > 0
                  ? 'bg-teal/15 text-teal'
                  : 'bg-accent/15 text-accent'
              }`}
            >
              {branchCount > 0 ? '✓' : '1'}
            </div>
            <div className="flex-1">
              <h2 className="font-head font-bold text-lg mb-1">
                Add your branches
              </h2>
              <p className="text-sm text-muted mb-3">
                Branches are your physical locations — warehouses, retail outlets,
                or production sites. Stock movements log which branch they
                originated from.
              </p>
              {branchCount > 0 ? (
                <p className="text-xs text-teal">
                  {branchCount} branch{branchCount === 1 ? '' : 'es'} added
                </p>
              ) : (
                <Link href="/settings/branches" className="btn btn-primary">
                  Add a branch →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Products */}
        <div
          className={`card p-5 ${
            productCount > 0
              ? 'opacity-60'
              : branchCount > 0
              ? 'border-accent/40'
              : ''
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                productCount > 0
                  ? 'bg-teal/15 text-teal'
                  : branchCount > 0
                  ? 'bg-accent/15 text-accent'
                  : 'bg-surface2 text-muted'
              }`}
            >
              {productCount > 0 ? '✓' : '2'}
            </div>
            <div className="flex-1">
              <h2 className="font-head font-bold text-lg mb-1">
                Import your product catalogue
              </h2>
              <p className="text-sm text-muted mb-3">
                Upload an Excel file with your products. We&apos;ll auto-detect
                the format for QuickBooks exports, master product lists, and
                stock movement files.
              </p>
              {productCount > 0 ? (
                <p className="text-xs text-teal">
                  {productCount} product{productCount === 1 ? '' : 's'} in catalogue
                </p>
              ) : branchCount > 0 ? (
                <Link href="/import" className="btn btn-primary">
                  Upload Excel file →
                </Link>
              ) : (
                <span className="text-xs text-muted italic">
                  Complete step 1 first
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Team */}
        <div className={`card p-5 ${branchCount === 0 ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                branchCount === 0
                  ? 'bg-surface2 text-muted'
                  : 'bg-accent/15 text-accent'
              }`}
            >
              3
            </div>
            <div className="flex-1">
              <h2 className="font-head font-bold text-lg mb-1">
                Invite your team
              </h2>
              <p className="text-sm text-muted mb-3">
                Add managers, warehouse staff, sales reps, and operators.
                Each user gets their own login and role-based access.
              </p>
              {branchCount > 0 ? (
                <Link href="/users" className="btn btn-ghost">
                  Invite users →
                </Link>
              ) : (
                <span className="text-xs text-muted italic">
                  Complete step 1 first
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-text"
        >
          Skip for now and go to dashboard →
        </Link>
      </div>
    </div>
  )
}
