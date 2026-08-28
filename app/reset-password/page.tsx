import { Suspense } from "react";
import ResetPasswordForm from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-full flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
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
