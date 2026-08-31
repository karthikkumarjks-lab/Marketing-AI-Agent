import { Resend } from "resend";

// Uses Resend's shared test sender until a real domain is verified — works
// immediately, no DNS setup required. Swap RESEND_FROM once a custom domain
// is verified in the Resend dashboard.
const FROM = process.env.RESEND_FROM || "Marketing Autopilot <onboarding@resend.dev>";

// Generic send used by the Email Builder — bulk campaigns and the
// send_email_template workflow action both funnel through this one
// function, same Resend account as password-reset email.
//
// AMP4EMAIL note: Resend's API has no field for an AMP payload (confirmed
// against its own type definitions, and resend/react-email discussion #1300
// tracks it as a requested-but-unshipped feature) — so a template's AMP
// version, if built, is exported as raw HTML the client can use with a
// provider that does support AMP sending (SendGrid, Braze, SparkPost) or
// validate independently; it is never silently dropped or claimed to have
// gone out through this function. Only the always-required plain `html`
// actually gets sent here.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set." };

  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set." };

  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: "Reset your Marketing Autopilot password",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #14181c;">Reset your password</h2>
          <p style="color: #545c57; line-height: 1.5;">
            Someone requested a password reset for your Marketing Autopilot account.
            If this was you, click the button below — it expires in 1 hour.
          </p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #129768; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              Reset Password
            </a>
          </p>
          <p style="color: #8a9089; font-size: 13px;">
            If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
        </div>
      `,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}
