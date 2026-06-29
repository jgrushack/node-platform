# NODE Members Wiki — Content Audit & Plan

**Purpose:** Decide what from the [Node Notion](https://www.notion.so/jgrushack/node-d23565943f8149b0a7964b79b3543f14) belongs in a **members-only wiki** on node.family.
**Scope reviewed:** Entire Camp Information hub + 2023–2025 archives (~45 pages, 3 databases).
**Method:** Every page was fetched and classified by content, type, sensitivity, and wiki-worthiness.
**Output:** A proposed section structure, a priority roadmap, and a do-not-publish list. *No code or page content has been written yet — this is the map to approve first.*

---

## 1. Guardrails (decisions baked into this plan)

- **Members-only.** The wiki lives behind login in the existing `(dashboard)` area. Middleware already enforces auth, so no public exposure of internal logistics, finances, or rosters.
- **Evergreen over ephemeral.** The wiki is a *reference layer* — timeless how-tos, policies, and SOPs. Year-specific planning (a given year's shopping list, lodging, schedule) stays in Notion as archive.
- **Don't duplicate live tools.** The app already has `/dashboard/jobs` (shift board), `/dashboard/payments` (dues/invoices), `/dashboard/members` (directory), `/dashboard/calendar` (events), `/dashboard/applications`. The wiki should *explain the rules* behind these (how points work, dues philosophy) — not re-implement the tools.
- **PII never gets copied.** Several archive pages contain home addresses, phones, personal emails, a door code, Zoom passwords, and a ~50-person roster. These are flagged in §5 and must not be pasted into a shared wiki.
- **Notion images will break.** Inline images use expiring S3/Notion signed URLs. Any image kept must be re-hosted in the app's own assets.

---

## 2. Proposed wiki structure

Ten sections. Each row: the source Notion page, a verdict, and what needs to happen to it.

**Verdict key:** ✅ INCLUDE (ready, light edit) · 🟡 EXTRACT (pull the reusable pattern/template, drop the year-specific parts) · ⛔ SKIP.

### A. About NODE — Identity, Values & Governance
| Source page | Verdict | Notes |
|---|---|---|
| 2023 NODE Values Brainstorm | ✅ | The identity-defining doc: mission, 6 value pillars, 10+1 Principles (incl. Consent/zero-strike). Anchor of the whole wiki. |
| The Node Foundation Charter | ✅ | 501(c)3 mission statement. Public-safe. |
| NODE Code of Conduct | ✅ | Cornerstone policy. Clean up the struck-through "Design Guidelines" block and the muddled strike-count wording before publishing. |
| Node Point System *(from 2023 archive)* | 🟡 | Reusable contribution/accountability framework (earn points via build/strike/Reno/pod-lead). Explains the logic behind `/dashboard/jobs`. Extract the framework, leave the archive page. |

### B. New Member Onboarding
| Source page | Verdict | Notes |
|---|---|---|
| Important Prep Milestones | ✅ | Jan–Aug "what happens when" timeline. Make wording year-agnostic. |
| Welcome Tour Instructions | ✅ | On-playa orientation script for greeting new campers. |
| 2025 Membership + Camp Dues Info | 🟡 | **Highest-value archive page.** Dues philosophy, sliding scale, what's included, member commitments, RV/tent rules. Genericize the dollar figures ($91k budget, $1,725/person) into a living template; pairs with `/dashboard/payments`. |

### C. Prep & Packing (Before the Burn)
| Source page | Verdict | Notes |
|---|---|---|
| Packing Checklist | ✅ | Core checklist. |
| Playa Newbie Protips | ✅ | Six survival tips; strong first-timer content. |
| BIKES BIKES BIKES | ✅ | Rental options, e-bike rules, fees. Refresh prices; remove the "tell Brad Jesse sent you" personal referral. |

*(Bikes are covered in 3 places — this page, the packing list, and newbie protips. Consolidate into one bikes cluster.)*

### D. On-Playa Survival & Reference
| Source page | Verdict | Notes |
|---|---|---|
| Burn Bible | ✅ | **Operational backbone** — build guides, ~15 job how-tos, party ops (DJ booth/Danley power protocol), emergency protocols (dust/rain/heat/trooper). |
| 2025 On-Playa Reference, Maps & Info | 🟡 | Rebuild as a blank "On-Playa Reference" page seeded with the durable links (BRC dashboard, porta map, lockscreen generator, tram pattern). Drop the year's map/weather images. Fold in the Passport "bring your own stamp" note. |

### E. Camp Operations & Volunteer Roles
| Source page | Verdict | Notes |
|---|---|---|
| Fluff Patrol How-To | ✅ | Clean volunteer how-to. |
| Lotus Belle Tent — Setup Instructions | ✅ | 14-step assembly guide; exactly what a wiki is for. |
| NODE Illumination Inventory | ✅ | Lighting-gear inventory (DB). Re-verify quantities (last touched 2024). |
| Morning Coffee Bar Planning | 🟡 | Keep the menu/recipes as a coffee-bar SOP; the 2023 buy-list is stale. |
| Post-Burn Content Sharing Guide | ✅ | How to upload photos to the communal Drive. Swap the year-specific Drive link for a current index link; keep behind login (link is publicly editable). |
| Shifts & Jobs system *(2025 Jobs DB + Job Board)* | 🟡 | Extract the *schema + points system* as an explainer for how `/dashboard/jobs` works. Do **not** copy the per-camper signup rows. |

### F. Build & Strike Playbook
| Source page | Verdict | Notes |
|---|---|---|
| 2024 Build/Strike Retro | ✅ | Mislabeled — it's actually a full build SOP (ordered sequence, per-structure hardware counts, generator distro). The best build doc in the set. |
| 2025 Build Schedule (build order) | 🟡 | Extract the generic build sequence only. **Strip the AirBnB address + door code 5953.** |
| 2025 Strike Schedule | 🟡 | Extract the generic teardown sequence; combine with build order into one playbook. |
| Off-season container maintenance *(2025 Reno trip)* | 🟡 | Pull the generic container-maintenance checklist. **Strip Truckee/Reno home addresses + flight itineraries.** |
| Container Inventory template *(2024/2025 snapshots)* | 🟡 | Keep one canonical blank inventory format; don't archive dated photo snapshots. |

### G. Programming & Events
| Source page | Verdict | Notes |
|---|---|---|
| Playa Programming | 🟡 | Keep the two recurring event write-ups (Roaming Street Market, Deep Playa Night Market); strip the ~98 image embeds. |
| 2025 Programming Schedule | 🟡 | Extract the grid template + signature events (Hip-Hop BBQ, Shabbat/White dinner, Pickle Ball, Technologia) as an idea bank. Live schedule belongs in `/dashboard/calendar`. |

### H. Music
| Source page | Verdict | Notes |
|---|---|---|
| Camp Music Guidelines | ✅ | Definitive "we're not a sound camp" policy + DJ vetting process. |
| Spotify Playlists | ✅ | 10 camp playlists; pairs with the guidelines. Refresh yearly. |

### I. Brand & Design
| Source page | Verdict | Notes |
|---|---|---|
| NODE Brand Kit | ✅ | Canonical: logos, hex palette, fonts, Figma. |
| Node Decor Moodboard | 🟡 | Valuable sourcing buy-list (~60 vendor links), but many will rot — curate. Drop the "2021 Solarpunk Saloon" child. |
| Camp Decor Inspiration | ⛔ | Thin; overlaps the moodboard. Fold a few images in, then drop. |

### J. Art Car / DMV *(small reference)*
| Source page | Verdict | Notes |
|---|---|---|
| 2025 Art Car, Golf Cart Ideation | 🟡 | Capture the BRC Mutant-Vehicle/DMV process + timeline (apps open Feb / close Apr) and build constraints (weight/battery). Drop the concept sketches. |

### K. Comms Archive *(optional, collapsed)*
| Source page | Verdict | Notes |
|---|---|---|
| Camp Email Archive | 🟡 | ~40 dated blasts, 2022–2026. Useful "what we communicate when" reference. Keep collapsed/secondary, not front-line. |
| Camp Call Archive | ⛔ | Ephemeral call chatter **and** a sensitivity risk (a home address, Zoom recording passwords). Skip, or heavily curate into a lessons-learned page only. |

---

## 3. Priority roadmap

**Tier 1 — Launch set (evergreen, members-safe, minimal editing).** Stand the wiki up with these:
Values & Culture · Foundation Charter · Code of Conduct · Welcome Tour · Prep Milestones · Packing Checklist · Newbie Protips · Bikes · Burn Bible · Music Guidelines · Brand Kit · Lotus Belle Tent.

**Tier 2 — High value, needs light extraction/genericizing.** Add next:
Membership & Dues · Build/Strike Playbook · Point System · Fluff Patrol · Illumination Inventory · Spotify · Post-Burn Content Sharing · Coffee Bar SOP · On-Playa Reference template.

**Tier 3 — Templates & nice-to-haves.** Add as time allows:
Programming events + schedule template · Shifts/Jobs explainer · Decor Moodboard · Art Car/DMV · Container inventory + off-season maintenance · Email Archive (collapsed).

---

## 4. Skip entirely (year-specific / admin / redundant)
Statement of Intent 2026 · 2026 Pre-Build · May Reno Trip House Options · Website Updates May 2026 · node.family Website Link · 2025 Final Plan/Shopping/Trello · 2025 Tahoe Decompression · 2025 Passport (distill one line into On-Playa Ref) · 2024 Post-Burn Container photos · 2024 Archived Pages · most of 2023 Archived Pages.

---

## 5. ⚠️ Do NOT publish — keep access-restricted (PII / sensitive)
- **2025 Master Camper Registry** — names, emails, dietary, dues/payment status, referrals for ~50 people. Highest-risk record in the set. Reuse the blank field structure only.
- **2023 Placement App & Statement of Intent '23** — home addresses, phone numbers, personal emails for multiple members. Extract patterns (acculturation, LNT, point system) only.
- **Scrub before any reuse:** AirBnB street address + **door code 5953** (2025 Build Schedule); Truckee/Reno home addresses + per-person flight itineraries (2025 Reno trip); **Zoom recording passwords** + a home address (Camp Call Archive).
- **Genericize if shared beyond leads:** the $91k budget / $1,725-per-person / full dues-tier table; Tahoe trip costs.
- **Statement of Intent 2026** contains two contacts' emails — redact if ever surfaced.

---

## 6. Cross-cutting cleanup before publishing
- **Re-host images.** All inline Notion/S3 images expire; image-heavy pages (Playa Programming ~98, Moodboard ~62) need trimming + re-hosting.
- **Dedupe bikes** across the Bikes page, Packing list, and Newbie Protips into one cluster.
- **Fix the Code of Conduct** struck-through section and contradictory strike-count language.
- **Refresh dated content:** bike rental prices, Illumination Inventory quantities (2024), Coffee Bar buy-list (2023), Spotify list.
- **Flag to the team:** the "2024 Build/Strike Retro" has no actual retrospective text — if real lessons-learned notes exist, they're elsewhere.

---

## 7. Where it lives in the app
The codebase has **no existing wiki, no markdown renderer, and no content tables** — long-form pages (e.g. `/vibes`, `/about`) are hardcoded `page.tsx` → `*-client.tsx` components.

**Lowest-effort placement:** a new `/dashboard/wiki` route following that same pattern. It inherits members-only protection from the dashboard layout/middleware automatically, and needs one nav line in `src/app/(dashboard)/layout.tsx`. If the wiki grows past a dozen pages, graduate the content into a Supabase `wiki_pages` table (slug, title, body, updated_at) — still gated by the same middleware, no new auth logic.

*(This is placement context only — implementation is a separate, later step per the agreed scope.)*

---

## Appendix — Source pages
All under [node → Camp Information](https://www.notion.so/jgrushack/node-d23565943f8149b0a7964b79b3543f14). Notion page IDs are listed inline in each section above; fetch any via `https://app.notion.com/p/<id>`.
