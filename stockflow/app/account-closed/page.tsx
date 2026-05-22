import { signOut } from '@/actions/auth'

export default function AccountClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">📁</div>
        <h1 className="font-head text-2xl font-bold mb-3">Account closed</h1>
        <p className="text-muted text-sm mb-6 leading-relaxed">
          This account has been closed. The data is retained for compliance
          purposes but the app is no longer accessible from this account.
        </p>
        <p className="text-xs text-muted mb-8">
          If you believe this is in error, contact{' '}
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
