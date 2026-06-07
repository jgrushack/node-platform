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

---

# Round 2 — Calendar / Events / Storage-Survey (WIP feature review)

Reviewed the bundled WIP via three parallel deep-reviews (calendar, events, storage)
plus a feature-completeness audit, then applied fixes and adversarially verified them.

## Completeness audit (merge-readiness — NOT bugs)

| Feature | Verdict | Notes |
|---|---|---|
| **Calendar** | Ready w/ minor gaps | Fully wired end-to-end; mergeable as v1. Biggest gap: the webcal/ICS subscribe link is only in invite emails, never surfaced on the calendar page. Fast-follows: recurring events, RSVP capture, explicit timezone. |
| **Events + invites** | Functional but incomplete | Wired MVP. Gaps: no per-recipient delivery tracking/resend; all-confirmed-or-nothing targeting (no preview/scope); `event_type` is cosmetic; RSVP is advertised in the ICS but nothing ingests replies. Mergeable behind the `isAdmin` gate as MVP. |
| **Storage survey** | Functional but incomplete — **has a blocker** | **BLOCKER: the created invoice has no working payment path** — the entire payments UI is demo-mode (Stripe/crypto placeholders), so the survey permanently inflates a member's balance with no way to pay. **MAJOR: two conflicting price catalogs** (survey bike $100/bin $60/AC $120 vs payments StorageFlow $75/$50/$100). **MAJOR: balance gate** — dashboard Balance is only set in the `confirmed` branch, so non-confirmed members who submit don't see the charge on the dashboard. **MAJOR: no admin view** of survey results; "No" answers store no row. |

**Recommendation surfaced to the user:** calendar = safe to merge; events = merge as MVP behind admin gate; **storage-survey needs product decisions before it bills anyone** (payment path, price reconciliation, balance gate) — those are design choices, deliberately NOT auto-fixed here.

## Fixes applied (bug-level; everything from the review except the public-feed gating)

| # | File | Fix |
|---|------|-----|
| 1 | `src/lib/calendar/ics.ts` + `calendar-client.tsx` | **Critical:** ICS time corruption. Postgres `time` returns `HH:MM:SS`; the old `time.replace(":","")` stripped only the first colon → invalid `DTSTART:…T2000:0000` for all 9 timed events (feed + emailed invites). Now normalized to `HHMMSS`; edit-form time inputs use `.slice(0,5)` so `<input type=time>` no longer silently drops the time. |
| 3 | `src/lib/actions/events.ts` | Invite send: replaced check-then-act with an **atomic conditional-update lock** (claim `invites_sent_at` null→now() before sending) — prevents double-inviting the whole membership on double-click/concurrent admins; **releases the lock** on every pre-delivery bail (no recipients, send error/throw, 0 delivered) so a transient failure no longer permanently bricks the event. Send wrapped in try/catch. |
| 4 | `ics.ts` + `calendar-invite.ts` | Injection hardening: `escapeText` now neutralizes CR/LF + strips control chars; the ICS `URL:` is `sanitizeUri`-gated (http(s) only, no control chars); the invite email HTML-escapes `firstName` (member-controlled), `title`, `description`, `joinLink`. |
| 5 | `src/lib/actions/storage-survey.ts` | **Money-safety:** duplicate-invoice / double-charge. Now an **atomic claim** on `storage_survey_completed_at` (null→now()) gates the insert; a second/concurrent submit returns idempotently with no second invoice; the claim is **released** if the camp-year lookup or invoice insert fails so a retry works. |
| 6 | `events.ts` | `updateNodeEvent` now enforces the same ownership rule as `deleteNodeEvent` (plain admin edits only own events; super_admin any). |
| 7 | `src/lib/types/event.ts` | Zod now validates `event_date` (`YYYY-MM-DD`) and `start_time`/`end_time` (`HH:MM[:SS]`), and rejects an end time with no start time. |
| 8 | `supabase/migrations/00042_*.sql` | Added explicit `WITH CHECK` to the `node_events` admin RLS policy (defense-in-depth; created_by intentionally not enforced so super_admins manage all). **Applied to live DB + verified via `pg_policy`.** |
| 9 | `ics.ts` | `foldLine` now folds at 75 **octets** (UTF-8), never splitting a multi-byte code point (emoji-safe). Also: explicit end-time ≤ start-time now rolls `DTEND` to the next day (overnight events). |
| 10 | `storage-survey-modal.tsx` + `page.tsx` | Escape hatch — when a submit error would otherwise trap the user in the non-dismissable modal, a "Dismiss for now" control appears (`onDismiss`, doesn't mark complete). |
| 11 | `calendar-client.tsx` + `storage-survey-modal.tsx` | Mobile: calendar action buttons `h-7`→`h-9` tap targets; month label `min-w` reduced on small screens; shortened the long storage Continue button label. |

**Not fixed (intentional / product decisions, surfaced to user):** #2 public ICS feed stays open (anyone with the link may join — per request); storage payment path, price-catalog reconciliation, balance-gate, and admin survey view are product decisions; recurring events / RSVP ingestion / webcal-subscribe UI are fast-follows.

## Verification (round 2)
- `npm run build` passes; `npm run test` 18/18 pass.
- Migration `00042` applied to live DB and `WITH CHECK` confirmed via `pg_policy`.
- Confirmed against live DB that `node_events.start_time` is `time` returning `"20:00:00"` (9 timed rows) — the bug that made #1 critical.
- Adversarial multi-agent verification workflow over every fix (diverse correctness/concurrency/regression lenses + completeness critic).
- The round-2 verification surfaced two follow-ups, both addressed in round 3: storage double-charge backstop (#5) and the `join_link` http(s) regression.

---

# Round 3 — Calendar subscribe, storage backstop, Google Calendar invites

## Webcal subscribe (calendar's last completeness gap)
- `calendar-client.tsx`: added a **Subscribe** button → dialog with one-tap
  `webcal://` add-to-calendar, copy-link field, and `.ics` download. The feed
  already existed; it just wasn't reachable from the UI.
- `types/event.ts`: tightened `join_link` to require **http(s)** so links can't
  be silently dropped from the ICS feed by `sanitizeUri` (round-2 regression fix).

## Storage double-charge — real DB backstop (#5, hardened)
- Migration `00043` (applied): `invoices.kind` column + partial unique index
  `uniq_storage_survey_invoice (profile_id, camp_year_id) WHERE kind='storage_survey_2026'`.
- `storage-survey.ts`: insert tags `kind`; a unique-violation (`23505`) is treated
  as already-charged (idempotent success). Combined with the atomic claim, a
  duplicate storage charge is now impossible even on a retry after a
  committed-but-unacked insert. Verified no existing duplicates in prod first.
- Event invite brick (#3): confirmed **not reachable** — max confirmed members is
  73 (< the 100 batch size), so it's single-batch; and it's eliminated by moving
  events to Google.

## Event invites + RSVPs → Google Calendar (chosen: A2, OAuth a dedicated Gmail)
- Migration `00044` (applied): `node_events.google_event_id` / `google_html_link`;
  `google_calendar_config` table (refresh token, RLS on + **no policies** =
  service-role only).
- `src/lib/google/calendar.ts`: hand-rolled OAuth refresh-token flow (no new deps,
  mirrors `google-sheets.ts`) + create/update/delete event (`sendUpdates=all`) +
  `getEventAttendees` (RSVP read-back) + TZ-aware time conversion.
- `src/app/api/google/calendar/{connect,callback}/route.ts`: admin-gated,
  CSRF-protected OAuth handshake; stores the refresh token server-side.
- `events.ts`: `sendEventInvites` now creates the Google event with attendees
  (Google sends invites + collects RSVPs); `updateNodeEvent`/`deleteNodeEvent`
  propagate edits/cancellations; new `getEventRsvps` + `getCalendarConnectionStatus`.
- `calendar-client.tsx` + `page.tsx`: "Connect Google Calendar" banner (admin),
  RSVP viewer (Going/Maybe/Can't/No-reply + names), `?gcal=` connect toast.
- Setup runbook: **`GOOGLE_CALENDAR_SETUP.md`**. Requires the admin to set
  `GOOGLE_OAUTH_CLIENT_ID/SECRET` and click Connect once. Not live-testable until
  then; verified by build + an adversarial logic/security workflow.

## Verification (round 3)
- `npm run build` passes; `npm run test` 18/18 pass.
- Migrations `00043` + `00044` applied to live DB.
- Adversarial workflow over the Google integration (OAuth security, calendar-client
  correctness, events rewiring, UI/data-exposure) + critic.
