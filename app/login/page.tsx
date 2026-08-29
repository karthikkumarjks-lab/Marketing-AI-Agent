import { Suspense } from "react";
import LoginForm from "@/components/login-form";
import AuthBackground from "@/components/auth-background";

export default function LoginPage() {
  return (
    <main className="min-h-full flex items-center justify-center px-4 relative">
      <AuthBackground />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-6">
          <div className="font-[family-name:var(--font-display)] font-semibold text-xl text-ink">
            Marketing Autopilot
          </div>
          <div className="text-sm text-ink-faint mt-1">Sign in to your workspaces</div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
