import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-auto max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          {/* Logo Placeholder */}
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back to StockFlow
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your dashboard
          </p>
        </div>
        
        <LoginForm />
        
        <p className="px-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="underline underline-offset-4 hover:text-primary">
            Sign Up
          </a>
        </p>
      </div>
    </div>
  )
}