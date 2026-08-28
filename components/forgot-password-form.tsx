"use client";

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="bg-surface border border-line rounded-lg p-5 text-center">
        <p className="text-sm text-ink-soft">
          If an account exists for <strong className="text-ink">{email}</strong>, a reset link is on its way —
          check your inbox (and spam folder). The link expires in 1 hour.
        </p>
        <Link href="/login" className="text-sm text-accent hover:underline mt-4 inline-block">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-5 space-y-3">
      <p className="text-sm text-ink-soft">Enter your account email — we&apos;ll send a link to reset your password.</p>
      <div>
        <label className="block text-xs text-ink-faint mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent text-white text-sm font-medium py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-xs text-ink-faint text-center pt-1">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
