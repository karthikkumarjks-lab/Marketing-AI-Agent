import { Suspense } from "react";
import ResetPasswordForm from "@/components/reset-password-form";
import AuthBackground from "@/components/auth-background";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-full flex items-center justify-center px-4 relative">
      <AuthBackground />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-6">
          <div className="font-[family-name:var(--font-display)] font-semibold text-xl text-ink">
            Marketing Autopilot
          </div>
          <div className="text-sm text-ink-faint mt-1">Choose a new password</div>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
