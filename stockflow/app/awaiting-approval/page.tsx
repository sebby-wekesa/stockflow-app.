import Link from 'next/link'
import { signOut } from '@/actions/auth'

export default function AwaitingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">⏳</div>
        <h1 className="font-head text-2xl font-bold mb-3">Awaiting approval</h1>
        <p className="text-muted text-sm mb-6 leading-relaxed">
          Your account is pending review by an administrator.
          You&apos;ll be able to use the system once your role is assigned.
        </p>
        <p className="text-xs text-muted mb-8">
          Questions? Reach out to{' '}
          <a href="mailto:support@springtech.co.ke" className="text-accent hover:underline">
            support@springtech.co.ke
          </a>
        </p>

        <form action={signOut}>
          <button type="submit" className="btn btn-ghost w-full">
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
