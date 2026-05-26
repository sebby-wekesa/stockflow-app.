// lib/emails/org-status.ts
//
// Email templates for org status transitions. Plain-text only by default —
// add HTML versions if you want richer formatting later, but plain text is
// universally readable, easier to maintain, and harder to break.

import { sendEmail, type SendEmailResult } from '../email'

interface OrgContext {
  ownerEmail: string
  ownerName: string | null
  organizationName: string
  appUrl: string
}

function greeting(name: string | null): string {
  if (!name) return 'Hello,'
  // Use first name if it looks like a full name
  const first = name.trim().split(/\s+/)[0]
  return `Hi ${first},`
}

function sign(): string {
  return [
    '',
    'Thanks,',
    'The StockFlow team',
    '',
    '— This is an automated message. Replies go to support.',
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVED
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOrgApprovedEmail(ctx: OrgContext): Promise<SendEmailResult> {
  const text = [
    greeting(ctx.ownerName),
    '',
    `Good news — your organization "${ctx.organizationName}" has been approved on StockFlow.`,
    '',
    'You can sign in now and start setting up your branches, importing your product catalogue, and inviting your team:',
    '',
    `  ${ctx.appUrl}/login`,
    '',
    "If you have any questions during setup, reply to this email and we'll get back to you.",
    sign(),
  ].join('\n')

  return sendEmail({
    to: ctx.ownerEmail,
    subject: `${ctx.organizationName} is approved on StockFlow`,
    text,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECTED
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOrgRejectedEmail(
  ctx: OrgContext & { reason: string }
): Promise<SendEmailResult> {
  const text = [
    greeting(ctx.ownerName),
    '',
    `Thanks for signing up "${ctx.organizationName}" on StockFlow.`,
    '',
    "Unfortunately, we're not able to activate your account at this time. The reason given by our team:",
    '',
    `  ${ctx.reason}`,
    '',
    "If you think this was a mistake or you'd like to discuss, please reply to this email.",
    sign(),
  ].join('\n')

  return sendEmail({
    to: ctx.ownerEmail,
    subject: `Your StockFlow signup could not be approved`,
    text,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUSPENDED
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOrgSuspendedEmail(
  ctx: OrgContext & { reason: string }
): Promise<SendEmailResult> {
  const text = [
    greeting(ctx.ownerName),
    '',
    `Your organization "${ctx.organizationName}" has been suspended on StockFlow.`,
    '',
    'Reason:',
    `  ${ctx.reason}`,
    '',
    'Your data is preserved — your team will see an explanation when they try to sign in. To resolve this, please reply to this email.',
    sign(),
  ].join('\n')

  return sendEmail({
    to: ctx.ownerEmail,
    subject: `${ctx.organizationName} has been suspended`,
    text,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVATED
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOrgReactivatedEmail(ctx: OrgContext): Promise<SendEmailResult> {
  const text = [
    greeting(ctx.ownerName),
    '',
    `Your organization "${ctx.organizationName}" has been reactivated on StockFlow.`,
    '',
    'Your team can sign in again and pick up where they left off:',
    '',
    `  ${ctx.appUrl}/login`,
    sign(),
  ].join('\n')

  return sendEmail({
    to: ctx.ownerEmail,
    subject: `${ctx.organizationName} has been reactivated`,
    text,
  })
}
