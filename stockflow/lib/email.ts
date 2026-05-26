// lib/email.ts
//
// Outbound transactional email.
//
// Backends:
//   1. Resend (production) — used when RESEND_API_KEY is set
//   2. Console log (dev/fallback) — used otherwise
//
// Why Resend and not nodemailer/SendGrid/etc.:
//   - REST API via fetch (no native deps, works in Edge runtime)
//   - Generous free tier (3k emails/month)
//   - Best DX for Next.js apps
// If you'd rather use another provider, swap the implementation of
// sendViaResend — the call sites don't change.
//
// To configure:
//   1. Sign up at https://resend.com
//   2. Add and verify your sending domain (e.g. notifications.fortunepath.co.ke)
//   3. Create an API key
//   4. Set env vars:
//        RESEND_API_KEY=re_...
//        EMAIL_FROM=StockFlow <noreply@notifications.fortunepath.co.ke>

export interface SendEmailParams {
  to: string | string[]
  subject: string
  /** Plain-text body. Always provide this for accessibility + deliverability. */
  text: string
  /** Optional HTML body. If omitted, providers will send a basic text-only email. */
  html?: string
  /** Optional reply-to override. Defaults to EMAIL_FROM. */
  replyTo?: string
}

export type SendEmailResult =
  | { ok: true; provider: 'resend' | 'console'; id?: string }
  | { ok: false; provider: 'resend' | 'console'; error: string }

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? 'StockFlow <onboarding@resend.dev>'
}

/**
 * Send an email. Routes to Resend if configured, otherwise logs to the
 * console (so developers can see what would have gone out).
 *
 * Always resolves — failures are returned as { ok: false }, never thrown.
 * Caller decides whether to retry, queue, or ignore.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(params)
  }
  return sendViaConsole(params)
}

async function sendViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const body = {
    from: getFromAddress(),
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    text: params.text,
    ...(params.html ? { html: params.html } : {}),
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Don't hang if Resend is slow — email is non-critical, retry later
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        ok: false,
        provider: 'resend',
        error: `Resend HTTP ${res.status}: ${errText.slice(0, 200)}`,
      }
    }

    const json = (await res.json()) as { id?: string }
    return { ok: true, provider: 'resend', id: json.id }
  } catch (err) {
    return {
      ok: false,
      provider: 'resend',
      error: (err as Error).message,
    }
  }
}

function sendViaConsole(params: SendEmailParams): SendEmailResult {
  console.log('─── [email/console] ─────────────────────────────────────────')
  console.log('To:', Array.isArray(params.to) ? params.to.join(', ') : params.to)
  console.log('Subject:', params.subject)
  console.log('---')
  console.log(params.text)
  console.log('────────────────────────────────────────────────────────────')
  return { ok: true, provider: 'console' }
}
