import SignupForm from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-full flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-[family-name:var(--font-display)] font-semibold text-xl text-ink">
            Marketing Autopilot
          </div>
          <div className="text-sm text-ink-faint mt-1">Create your account</div>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}
