# Google Calendar invites — setup (A2: OAuth a dedicated Google account)

Event invites + RSVPs are handled by a single dedicated Google account
(`noderepublik@gmail.com`). The app creates events on that account's calendar
with the confirmed members as attendees; Google emails the invites and collects
RSVPs natively, which we read back into the dashboard.

## One-time Google Cloud setup (done by an admin)

1. **console.cloud.google.com** — sign in as the camp Google account.
2. **APIs & Services → Library →** enable **Google Calendar API** (not "Calendar MCP").
3. **OAuth consent screen** → External; app name + support/dev email = the camp
   Gmail; add scope `.../auth/calendar.events`.
   - ⚠️ **Publishing status → "In production"** (not Testing) — otherwise the
     refresh token expires every 7 days. It will show as "unverified"; click
     through the warning once at connect time.
4. **Credentials → Create OAuth client ID → Web application.** Authorized
   redirect URIs:
   - `https://node.family/api/google/calendar/callback`
   - `https://www.node.family/api/google/calendar/callback`
   - `http://localhost:3000/api/google/calendar/callback`
5. Set env vars (Vercel + `.env.local`):
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - (redirect URI is derived from the request origin — no env needed)
6. Redeploy. Then in **Dashboard → Calendar**, an admin clicks **"Connect
   Google Calendar"**, authorizes as the camp Gmail, and clicks through the
   one-time "unverified app" warning. The refresh token is stored in the
   `google_calendar_config` table (service-role-only; RLS on, no policies).

## How it works after connecting

- **Send invites** (per event) → creates the event on the camp calendar with all
  confirmed members as attendees (`sendUpdates=all`). Stores `google_event_id`.
- **Edit an event** → patches the Google event (attendees get the update).
- **Delete an event** → cancels the Google event (attendees get a cancellation).
- **RSVPs** → the dashboard reads each attendee's `responseStatus` back from
  Google (Going / Maybe / Can't / No reply) via the "RSVPs" button.

## Security notes

- Refresh token lives only in `google_calendar_config` (service-role only).
- OAuth routes are admin-gated and CSRF-protected with a state cookie.
- If you pasted the client secret anywhere public, **reset it** in Cloud Console
  (Credentials → client → Reset secret) and update the env var.

## Known follow-ups (not blocking)

- Re-sending to members confirmed *after* the first send (currently the event is
  "sent once"; a future "re-sync attendees" can patch the guest list).
- The old Resend-based invite path (`sendEventInviteBatch`, `calendar-invite.ts`)
  is now dead code — safe to remove in a cleanup pass. `ics.ts` is still used by
  the public `/api/calendar.ics` webcal feed.
