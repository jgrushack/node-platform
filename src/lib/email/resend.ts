import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("[Resend] RESEND_API_KEY is not set — emails will fail to send");
}

let _resend: Resend | null = null;

/**
 * Lazily construct the Resend client. The Resend constructor THROWS when the
 * API key is missing, so building it at module load would crash any importer —
 * including routes that only pull a constant like REPLY_TO_EMAIL (e.g. the
 * /api/calendar.ics route). That crash surfaces during `next build`'s page-data
 * collection, where RESEND_API_KEY isn't present. Construct on first send so a
 * bare import never touches the constructor.
 */
export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "NODE <camp@node.family>";

export const REPLY_TO_EMAIL =
  process.env.RESEND_REPLY_TO || "camp@node.family";
