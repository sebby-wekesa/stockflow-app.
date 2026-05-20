export default function AccountClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center p-8">
        <div className="mx-auto mb-6 w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6h12v12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4">Account Closed</h1>
        <p className="text-muted mb-6">
          This organization has been permanently closed. If you believe this is an error, please contact support.
        </p>
        <a href="/login" className="btn btn-primary">
          Return to Login
        </a>
      </div>
    </div>
  );
}
