import { SignupForm } from "@/components/auth/signup-form"

export default function SignupPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full mx-auto max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-md">
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Create your StockFlow account
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter your details to get started
          </p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="underline underline-offset-4 hover:text-primary">
            Sign In
          </a>
        </p>
      </div>
    </div>
  )
}