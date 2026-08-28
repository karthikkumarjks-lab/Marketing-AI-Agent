"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not reset password.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <div className="bg-surface border border-line rounded-lg p-5 text-center">
        <p className="text-sm text-danger">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="text-sm text-accent hover:underline mt-3 inline-block">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-surface border border-line rounded-lg p-5 text-center">
        <p className="text-sm text-ink-soft">Password updated — redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-5 space-y-3">
      <div>
        <label className="block text-xs text-ink-faint mb-1">New password (min. 8 characters)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoFocus
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent text-white text-sm font-medium py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {pending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
