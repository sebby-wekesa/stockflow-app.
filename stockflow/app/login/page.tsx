export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stockflow-bg font-dmsans text-[#e8eaed]">
      <div className="w-full max-w-[400px] space-y-8 p-6">
        {/* Logo Section */}
        <div className="flex flex-col items-center">
          <div className="font-syne text-3xl font-extrabold tracking-tighter text-stockflow-accent">
            STOCKFLOW
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[2px] text-stockflow-muted">
            Manufacturing Platform
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-[10px] border border-stockflow-border bg-stockflow-surface p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h2 className="font-syne text-xl font-bold">Secure Access</h2>
            <p className="text-sm text-stockflow-muted">Enter operator credentials</p>
          </div>

          <form className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-stockflow-muted">
                Email Address
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-[#353a40] bg-[#1e2023] p-3 text-sm focus:border-stockflow-accent focus:outline-none"
                placeholder="name@stockflow.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-stockflow-muted">
                Access Token / Password
              </label>
              <input
                type="password"
                className="w-full rounded-md border border-[#353a40] bg-[#1e2023] p-3 text-sm focus:border-stockflow-accent focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button className="mt-6 w-full rounded-md bg-stockflow-accent py-3 text-sm font-bold text-black transition-all hover:bg-[#f5d060]">
              AUTHENTICATE
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-stockflow-muted">
          <p>Don&apos;t have an account?
            <a href="/signup" className="ml-1 text-stockflow-accent hover:underline">
              Request Access
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}