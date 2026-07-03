// -----------------------------------------------------------------------------
// Client-side security event reporter
// -----------------------------------------------------------------------------
// Fire-and-forget POST to the FastAPI `/api/security/event` endpoint with
// redacted detail. Never blocks UX — failures are silently swallowed.
//
// Call sites:
//   • Auth.tsx        — on failed sign-in (`login_failed`)
//   • gemini.ts       — 429 (`rate_limit_hit`), non-2xx (`ai_failure`),
//                       zod parse fail (`validation_error`)
// -----------------------------------------------------------------------------

import { auth } from '@/lib/firebase';

export type SecurityEventType =
  | 'login_failed'
  | 'ai_failure'
  | 'rate_limit_hit'
  | 'validation_error';

const BACKEND_URL = (import.meta.env.VITE_AI_BACKEND_URL || '').replace(/\/$/, '');

/**
 * Redact obvious credentials from a free-text detail string.
 * - Long uppercase/digit runs (API-key shaped) → `[REDACTED]`
 * - Email addresses → `[EMAIL]`
 * Caps to 200 chars.
 */
export function redact(input: string): string {
  return input
    .replace(/[A-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
    .slice(0, 200);
}

export async function logSecurityEvent(
  type: SecurityEventType,
  detail: string,
): Promise<void> {
  if (!BACKEND_URL) return;
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return; // anonymous events not logged (backend requires auth)
    await fetch(`${BACKEND_URL}/api/security/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        detail: redact(detail),
        at: Date.now() / 1000,
      }),
      keepalive: true,
    });
  } catch {
    // never break UX for a logging call
  }
}
