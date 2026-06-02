# Codebase Review & Fixes — 2026-05-31

Full review of the NODE platform (Next.js 16 / React 19 / Supabase) for mobile-friendliness, security, and correctness bugs. Driven by three parallel audits (mobile, security, correctness). This file records every change made.

## Reported issue
- **Messages page required horizontal side-scroll on mobile.** Root cause found and fixed (see Mobile #1).

---

## Mobile / responsiveness

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `src/app/(dashboard)/layout.tsx` | Added `min-w-0` to the main content column (`flex flex-1 flex-col`) | **Root cause of the reported side-scroll.** A flex item defaults to `min-width:auto`, so any wide child (the `min-w-[700px]` applications table, long emails, the email iframe) forced the whole column wider than the viewport. With `min-w-0`, wide children scroll *inside their own cards* instead of widening the page. Fixes side-scroll app-wide. |
| 2 | `src/app/(dashboard)/layout.tsx` | Added `min-w-0` to the content `ScrollArea` | Defense-in-depth for the Radix scroll viewport. |
| 3 | `src/app/(dashboard)/dashboard/reports/reports-client.tsx` | Added `flex-wrap` to the two status-filter button rows | 5 filter buttons + search didn't wrap on narrow phones. |

---

## Security

| # | File | Change | Severity | Why |
|---|------|--------|----------|-----|
| 4 | `src/app/(dashboard)/dashboard/messages/messages-client.tsx` | Sanitize message HTML with DOMPurify at both `innerHTML` sinks (`RenderHtml` render + `setEditorContent`) | Medium | Camp message `body_html` was rendered via raw `innerHTML` into every recipient's authenticated dashboard. Admin-authored, but no sanitization = any `<img onerror>`/`<svg onload>` would execute with the victim's session. DOMPurify (already a dependency) now neutralizes the execution sink regardless of stored content. |
| 5 | `src/lib/email/templates/camp-message.ts` | HTML-escape `subject` in `<title>` | Low | Unescaped interpolation; defense-in-depth. |

---

## Correctness

| # | File | Change | Severity | Why |
|---|------|--------|----------|-----|
| 6 | `src/app/(dashboard)/dashboard/messages/messages-client.tsx` | Autosave: added `editingDraftId` + audience state to effect deps; reset `lastSavedRef` on draft load/reset | High | Autosave could create **duplicate drafts** (stale `editingDraftId` closure + change-detection ref never reset on load) and **silently dropped audience-only edits** (audience state wasn't a dependency). |
| 7 | `src/lib/actions/messages.ts` + `messages-client.tsx` | Inbox "delete" now removes only the user's own `message_recipients` row via new `dismissMessage()` action (was calling `deleteMessage` which deletes the whole message for **all** recipients) | High | An admin dismissing one inbox item destroyed the message for everyone. |
| 8 | `src/lib/calendar/ics.ts` | Default end-time now rolls the date forward when start hour is 23:xx (was `(h+1)%24` producing `DTEND` before `DTSTART`) | Medium | Late-evening events generated invalid/negative-length calendar invites. |
| 9 | `src/lib/actions/messages.ts` | `previewRecipients`: dedupe registration years per profile (Set) and exclude profiles with no email | Medium | Duplicate registration rows inflated tenure counts (og/veteran/first-year); null-email profiles were counted as recipients but never delivered. |
| 10 | `src/lib/email/send.ts` + `messages.ts` | `email_sent` is now stamped only for recipients in batches that actually succeeded (was stamping **all** recipients if any batch sent) | Medium | Partial send failures were recorded as fully delivered. |
| 11 | `src/app/(dashboard)/layout.tsx` | Unread-count effect guards against out-of-order responses | Low | Fast navigation could show a stale unread badge. |

---

---

## Security follow-up: CSP hardening (`next.config.ts`)

Tightened the Content-Security-Policy with `form-action 'self'` and
`frame-ancestors 'none'` (alongside the existing `object-src 'none'` /
`base-uri 'self'`).

**Attempted but reverted: a strict per-request nonce CSP** (removing
`script-src 'unsafe-inline'`). A nonce-based CSP was implemented in middleware
and then **reverted after a production smoke test caught a regression**: most
pages here are statically prerendered (`○` in the build), so their inline
bootstrap scripts are emitted at *build* time and can't carry a per-request
nonce — the strict CSP blocked all 7 inline scripts (verified: 0/25 scripts
nonced), which would white-screen those pages in a browser. Making it strict
would force every page (including the public marketing pages) into dynamic
rendering, a poor trade for defense-in-depth given the actual stored-content
XSS sink (camp messages) is already DOMPurify-sanitized (#4).

`script-src` therefore intentionally keeps `'unsafe-inline'`/`'unsafe-eval'`;
the rationale is documented inline in `next.config.ts`.

**Verified safe** via `next build` + `next start` smoke test: `/login` and `/`
return 200 with all inline scripts intact; `/dashboard` still 307-redirects
unauthenticated users; new directives present on every response.

---

## Verification
- `npm run build` — type-check / compile (passes)
- `npm run test` — existing test suite (18/18 pass)
- `next start` production smoke test — CSP header correct, static pages render,
  auth redirect intact
- Migration `00041` applied to live DB (`qcbghpsrcjkjeykrxkcd`) and policy
  verified via `pg_policy`

See git diff for exact line-level changes.
