import ForgotPasswordForm from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-full flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-[family-name:var(--font-display)] font-semibold text-xl text-ink">
            Marketing Autopilot
          </div>
          <div className="text-sm text-ink-faint mt-1">Reset your password</div>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
