export default function AwaitingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center p-8">
        <div className="mx-auto mb-6 w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4">Account Pending Approval</h1>
        <p className="text-muted mb-6">
          Your organization has been created successfully. An administrator will review and approve your account shortly.
        </p>
        <p className="text-sm text-muted">
          You will receive an email notification once your account is approved.
        </p>
      </div>
    </div>
  );
}
