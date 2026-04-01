# User Roles & Status Reference

## Roles

There are 4 roles, defined in `profiles.role`:

| Role | Description |
|------|-------------|
| **member** | Default role. Standard dashboard access. |
| **lead** | Camp lead. Functionally identical to member — exists as a messaging audience filter so admins can target leads specifically. |
| **admin** | Full moderation: application review, messaging, reports. |
| **super_admin** | System admin: user management, role changes, calendar events, invite links, camper standings, view-as masquerade. |

### Permissions Matrix

| Capability | member | lead | admin | super_admin |
|------------|--------|------|-------|-------------|
| Dashboard, Members, Calendar, Profile, Messages, Payments | Y | Y | Y | Y |
| View application summary + request committee | Y | Y | Y | Y |
| Vote on / review applications | committee | committee | Y | Y |
| Add application comments | committee | committee | Y | Y |
| Send camp messages | - | - | Y | Y |
| View Reports tab | - | - | Y | Y |
| Approve / reject / override applications | - | - | - | Y |
| Delete applications | - | - | - | Y |
| Create / edit calendar events | - | - | Y | Y |
| Delete calendar events | - | - | own only | Y |
| Users tab (manage roles, edit profiles) | - | - | - | Y |
| Approve / reject committee requests | - | - | - | Y |
| Generate invite links | - | - | - | Y |
| View / set camper standings | - | - | - | Y |
| View-as role masquerade | - | - | - | Y |

### Committee Membership

Committee access is **independent of role** — controlled by the `is_committee_member` boolean on profiles. Any role can be a committee member. Committee members can:

- View full application review interface (votes, video, details)
- Cast votes on applications
- Add comments to applications

Auto-approval triggers when an application receives **4** "yes" votes from committee members.

### Auth Guard Functions

Server actions enforce permissions with these guards (defined in `src/lib/actions/`):

| Function | Allows | Used by |
|----------|--------|---------|
| `requireAdmin()` | admin, super_admin | `sendMessage`, `getApplicationsWithVotes`, `castVote`, `createNodeEvent`, `updateNodeEvent`, `deleteNodeEvent` (ownership check for admin) |
| `requireAdminOrSuperAdmin()` | admin, super_admin | `approveApplication` (via auto-approve only) |
| `requireSuperAdmin()` | super_admin only | `getUsers`, `updateUserRole`, `updateUserProfile`, `generateInviteLinks`, `getCommitteeRequests`, `handleCommitteeRequest`, `adminOverrideStatus`, `deleteApplication` |

---

## Application Status

Stored in `applications.status`:

| Status | Meaning | Triggered by |
|--------|---------|-------------|
| **pending** | Submitted, awaiting review | User submits application at `/apply` |
| **approved** | Accepted into camp | 4 committee "yes" votes (auto) or admin override |
| **rejected** | Not accepted | Admin override |
| **waitlist** | On the waitlist | Admin override |

### Approval Side Effects

When an application is approved (`approveApplication()`):

1. Creates an `auth.users` account (if none exists) with email confirmed
2. Generates a magic link and sends "You're In!" email via Resend
3. Creates/updates the `profiles` row with application data
4. Creates a **confirmed** registration for 2026 camp year
5. Links the application to the profile via `profile_id`

---

## Registration Status

Stored in `registrations.status`:

| Status | Meaning |
|--------|---------|
| **pending** | Registered for a camp year, not yet confirmed |
| **confirmed** | Confirmed for the year |
| **waitlisted** | On the waitlist for the year |
| **cancelled** | Cancelled their registration |

Additional fields: `has_ticket` (boolean), `has_car_pass` (text: yes/no/need_ride/burner_express).

---

## Invoice Status

Stored in `invoices.status`:

| Status | Meaning |
|--------|---------|
| **draft** | Created, not yet sent |
| **sent** | Invoice sent to member |
| **partial** | Partially paid |
| **paid** | Fully paid |
| **overdue** | Past due date |
| **cancelled** | Cancelled |
| **refunded** | Refunded |

---

## Job Signup Status

Stored in `job_signups.status`:

| Status | Meaning |
|--------|---------|
| **signed_up** | Signed up for a shift |
| **completed** | Completed the shift |
| **no_show** | Did not show up |
| **cancelled** | Cancelled signup |

---

## Committee Request Status

Stored in `committee_requests.status`:

| Status | Meaning |
|--------|---------|
| **pending** | Request submitted, awaiting super_admin review |
| **approved** | Approved — `is_committee_member` set to true |
| **rejected** | Request denied |

---

## Camper Standings

Stored in `camper_standings` table, managed by super_admin only:

| Standing | Meaning |
|----------|---------|
| **good** | Good standing |
| **limited_referrals** | Limited referral privileges |
| **reapply** | Must reapply next year |
| **not_invited_back** | Not invited to return |

---

## Onboarding Flow

1. Application approved → magic link email sent
2. User clicks link → auth callback creates session, profile already exists
3. Dashboard loads → **Set Password dialog** (if no password set)
4. **Onboarding Checklist** appears (if `onboarding_completed_at` is null):
   - Step 1: Attending 2026? (yes/no)
   - Step 2: Complete required profile fields (first_name, last_name, phone, dietary_restrictions, emergency_contact)
   - Step 3: Prebuild RSVP (if attending)
5. All steps done → `onboarding_completed_at` set, checklist hides
