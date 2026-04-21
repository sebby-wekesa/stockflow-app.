import { SignupForm } from "@/components/auth/signup-form"

export default function SignupPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-auto max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          {/* Logo Placeholder */}
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your StockFlow account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your details to get started
          </p>
        </div>

        <SignupForm />

        <p className="px-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="underline underline-offset-4 hover:text-primary">
            Sign In
          </a>
        </p>
      </div>
    </div>
  )
}