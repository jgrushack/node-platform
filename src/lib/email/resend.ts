import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("[Resend] RESEND_API_KEY is not set — emails will fail to send");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "NODE <camp@node.family>";

export const REPLY_TO_EMAIL =
  process.env.RESEND_REPLY_TO || "camp@node.family";
