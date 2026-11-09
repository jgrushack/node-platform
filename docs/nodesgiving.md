# Nodesgiving · November 21, 2026

The member page is `/dashboard/nodesgiving`, linked in the dashboard navigation and calendar. This feature is scoped to the 2026 gathering. Migration `00062_nodesgiving.sql` was applied and recorded as version `00062` on the linked Supabase project `qcbghpsrcjkjeykrxkcd` on November 4, 2026. Other environments still need this migration before using the page. The connected project's earlier migration versions differ from the local filenames, so this migration was applied in an explicit transaction and recorded without modifying prior history. The migration creates the event, an empty menu, RSVP storage, and transactional RPCs. It also corrects the existing 2026 Nodes Giving calendar entry to November 21. It does not send invitations or update previously sent Google Calendar invitations.

Admins and super admins manage the menu on the same page. Add the slot name, category, signup limit, suggested servings per signup, and instructions. A slot is immediately available after saving. Each member can claim one place per slot and select multiple slots for their household. Members specify their actual recipe, serving quantity, and optional co-cooks. A guest does not need an account and shares that household's commitments. Claimed dishes cannot be deleted or redefined; their signup limits can be adjusted without dropping below existing commitments.

Members can save Yes or No, with an optional single guest when Going. RSVPs can be saved before the menu exists. Changing to No releases all dishes and removes the guest. Hosts see the response list, names, guest names, commitments, member dietary needs read from NODE profiles, and separately entered guest dietary notes. Members update their own dietary needs through the linked profile page. Other signed-in members see aggregate counts, menu availability, their own response, and the shared dish list (contributor names, dish names, servings, and co-cooks). They cannot see another member’s guest details or dietary notes. Members who have not responded are not included in the response list. Time and location remain unspecified.

Writes use the signed-in Supabase client. The database serializes all RSVP and menu changes on the event row, checks capacity, and saves the RSVP and its commitments atomically. Tables deny direct access by authenticated and anonymous roles; RPCs perform authentication and host authorization. No service-role client is used.

Validation:

- `npm run build`
- `npm run test -- --run src/lib/actions/__tests__/nodesgiving.test.ts 'src/app/(dashboard)/dashboard/nodesgiving/__tests__/nodesgiving-client.test.tsx'`
- `node scripts/test-nodesgiving-db.mjs /absolute/path/to/pglite/dist/index.js` runs the actual migration and authorization/capacity checks in an ephemeral PGlite database. With `@electric-sql/pglite` locally available, omit the path. It never connects to Supabase.

## Production deployment

Published to the existing Vercel project on November 4, 2026: `dpl_CypRx8HhEvKWUxXvqQz6MhEdkdGv` (`https://nodev0-f6okt2c3c-jesse-s-projects-b64c7420.vercel.app`). Live page: https://www.node.family/dashboard/nodesgiving. Vercel reports READY with the Nodesgiving server route; the home and login pages return 200 and unauthenticated requests to Nodesgiving redirect to login. The 13 focused Nodesgiving tests passed before release. The release was uploaded from a clean temporary source snapshot; local environment files and unrelated workspace files were excluded.

On November 5, 2026, deployment `dpl_6u6RzHXrs4qoSmLPCZYNzhxZjQCu` added the dashboard-top Nodesgiving banner. Production build passed; the banner was visually checked in the signed-in live dashboard and its link verified to open the Nodesgiving page. Menu proposals remain in chat until the hosts approve them.

## Yes/no RSVP update

Migration `00063_nodesgiving_yes_no_dietary.sql` removes Maybe submissions at the database and form layers. Existing tentative responses, if any, are retained as needing a new yes/no response. Earlier combined dietary notes are preserved for hosts to clarify; they are never copied into someone’s profile or attributed to a guest automatically. New guest notes use a separate column and are cleared when the guest is removed or the member declines. The new RSVP RPC is `save_nodesgiving_rsvp_v2`; stale clients receive a refresh message from the previous RPC. The event is planned for about 20 people (not a hard attendance cap), with NODE covering turkey, gravy, and a vegetarian main. Guest menu suggestions remain in chat pending approval.

Applied migration `00063` and published deployment `dpl_8pUnZA5dVFi2BKEssn2gkUbEPwEg` on November 5, 2026. Production build, lint of changed feature files, 14 focused feature tests, and ephemeral database migration/privacy tests passed. The full suite retains the seven existing survey failures. The signed-in production page was checked for two response choices, profile dietary display, conditional guest dietary input, and untouched saved RSVP state. No menu items or attendance responses were created.


## Flexible menu and shared contributions

Migration `00064_nodesgiving_flexible_menu.sql` adds named dishes, serving quantities, co-cooks, private suggestions, and RSVP revision checks. It preserves existing menus and commitments. When the menu is empty, it seeds 11 food contributions: potatoes (1), stuffing (1), comfort side (1), vegetables (2), salads (2), bread (1), cranberry accompaniment (1), and desserts (2). NODE covers turkey, gravy, and the vegetarian main. Everyone is expected to help with setup and cleanup; there are no separate helper signup slots. Members can pair up on food rather than preparing 20 separate dishes.

The shared list helps people coordinate recipes. New commitments reject duplicate dish names after ignoring capitalization, spacing, and punctuation, including across different slots. This is not semantic recipe matching: differently named variations still require members to read the list. Capacity and duplicate checks execute under the same event lock as all other writes.

A member with a saved yes RSVP can have one pending suggestion at a time. Suggestions and notes are visible only to their author and hosts. Hosts approve into an available slot in the same category or decline with an optional note. Approval creates the commitment immediately and increments the member’s RSVP revision; it does not expand the slot limit. A stale RSVP save fails and reloads current commitments rather than deleting an approval. Members can withdraw pending suggestions; saving No withdraws them and releases all commitments. The RSVP RPC is now `save_nodesgiving_rsvp_v3`; v2 asks old clients to refresh.

The ephemeral database harness covers migration preservation, seed counts, authenticated permissions, privacy, capacity conflicts, duplicate names, revision conflicts, suggestion review and withdrawal, and release on declining. UI tests cover named shared dishes and refreshing an RSVP after host approval.

Applied migration `00064` and published deployment `dpl_5WEc17bi4nBZUuNznN9RWoocrbM1` (`https://nodev0-p6c8yv33y-jesse-s-projects-b64c7420.vercel.app`) on November 5, 2026. Vercel aliased the successful production build to `https://www.node.family`. The migration verified 11 menu slots and no existing RSVPs or commitments. Build, feature lint, all 18 focused tests, and the ephemeral PostgreSQL checks passed; the full suite has 49 passing tests and seven preexisting survey failures. Live verification confirmed menu limits, shared setup/cleanup instructions, and dish/servings/co-cook inputs. Unsaved test entries were cleared by reloading; no test attendance was submitted. Deployment used `/private/tmp/nodesgiving-flex-release-t3v4nd1q`, excluding local secrets and unrelated workspace files.

## Flyer and visual refresh

On November 5, 2026, deployment `dpl_6jxhdWdPrP84Dkw9Aa8bkcdew2BR` (`https://nodev0-8vetm03ah-jesse-s-projects-b64c7420.vercel.app`) added the supplied flyer, sunset/lavender hero, illustrated category headings, compact menu cards, warm RSVP buttons, and matching dashboard banner. The flyer supplies the event details: November 21 at 6 PM, the private address shown on the member page. The hero links directly to the focusable RSVP heading.

The original flyer is stored at `src/assets/nodesgiving/flyer.jpeg` and served through the session-authenticated `/dashboard/nodesgiving/flyer` route with private/no-store caching. It is not in `public/`; Next.js output tracing explicitly includes it in the route bundle. The `next/image` instance uses `unoptimized` so it loads through the protected route rather than a public image optimization cache. The live image was verified to load at its native 1067 × 1600 dimensions. Feature lint, production build, and all 18 Nodesgiving tests passed. No database changes were needed.

## Direct dish editing and two potato dishes

The guest invitation and setup/cleanup instructions now use the host’s supplied wording, with spelling and punctuation corrected. Migration `00065_nodesgiving_two_potato_dishes.sql` opens a second potato signup and suggests 10 servings per contribution, with mashed, sweet, or roasted potatoes as examples. Existing named commitments are preserved. The seeded menu now has 12 available contributions in total.

The separate suggestion/approval form is no longer displayed. Members choose the closest open menu slot, enter any recipe, and directly edit their saved dish, servings, and co-cooks through the RSVP form. No host approval is required. Existing capacity and duplicate-name checks remain. Host-only shared-menu management and private attendee details are unchanged. Historical suggestion storage and RPCs remain for backward compatibility; production had no pending suggestions when this flow was retired.

Build, lint, all 18 focused feature tests, and the ephemeral database harness passed. The database harness verifies two distinct potato claims, preservation of the existing recipe, and direct self-service recipe changes by both contributors.

Applied migration `00065` and deployed `dpl_F6wAfgSU2bodCzMvFEEqbBLAtoCS` (`https://nodev0-pd78vsco7-jesse-s-projects-b64c7420.vercel.app`) on November 5, 2026. Vercel aliased the successful build to `https://www.node.family`. Signed-in live verification confirmed both revised notes, two potato places, the direct-edit instructions, and removal of the approval form. No test RSVP was submitted.


## Guest policy and private event details

Plus-ones are limited to partners or prospective NODE members, with one guest per member; the event is not an open invitation. This is stated both in the event notes and next to the RSVP guest option.

Migration `00066_nodesgiving_private_event_details.sql` adds the event location and private flyer storage. The source repository is public, so residential address data and flyer bytes are populated separately during deployment. The local image directory is ignored by Git and excluded from the release snapshot. The authenticated flyer route now reads through `get_nodesgiving_flyer`, retaining private/no-store responses; direct table reads are denied. Event location is returned only through the existing authenticated event RPC. The earlier filesystem/output-tracing implementation is superseded.
