# Contributing to NODE

Thanks for helping. This is a small project — a quick read here saves everyone friction later.

## One-time setup

Fork the repo on GitHub, then:

```bash
git clone https://github.com/<your-username>/node-platform.git
cd node-platform
git remote add upstream https://github.com/jgrushack/node-platform.git
git fetch upstream
npm install
cp .env.local.example .env.local   # ask the maintainer for values
```

Your `origin` is your fork. `upstream` is the canonical repo. You will pull from `upstream` and push to `origin`.

## The branching rule

**Never commit to `main` — yours or upstream's.** Branch off it.

```bash
git checkout main
git pull upstream main          # sync your local main with upstream
git push origin main            # keep your fork's main current
git checkout -b feature/short-descriptive-name
```

Branch-name examples: `feature/gallery-sub-nav`, `fix/video-upload-progress`, `copy/about-2026`.

## While you're working

Keep your branch fresh as `main` advances:

```bash
git fetch upstream
git rebase upstream/main        # or `git merge upstream/main` if rebase is intimidating
```

If you hit conflicts, resolve them, `git add` the files, then `git rebase --continue` (or `git commit` for merge).

## Opening a PR

1. Push your branch: `git push -u origin feature/your-branch`.
2. Open a PR from `your-fork:feature/your-branch` → `jgrushack:main`. **Not** from your fork's `main`.
3. **Tick "Allow edits from maintainers"** on the right side of the PR description. This lets the maintainer push small fixes (typos, conflict resolutions) directly to your branch instead of asking you to open a new PR.
4. Title format: `Area: short imperative summary`. Examples: `Gallery: add tabbed sub-nav`, `Apply form: require previous camps`.
5. Description: what changed and why, in 1–3 short paragraphs. Bullet lists for non-trivial work. Screenshots for visual changes.

## Scope

One logical change per PR. A 112-file PR that bundles homepage tweaks, About copy, Vibes images, and a new Gallery is hard to review and impossible to revert cleanly. Split it: one PR per page, or one PR per concern (copy vs. layout vs. images vs. navigation).

## `package-lock.json`

**Do not touch the lockfile unless you actually changed dependencies.** A rerun of `npm install` on a different OS regenerates the file with churn that always conflicts.

If your branch has a noisy lockfile diff but you didn't add/remove/upgrade any package:

```bash
git checkout upstream/main -- package-lock.json
git commit --amend --no-edit
```

If you did change deps, only the relevant entries should differ.

## Code conventions

- **Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui, Supabase.
- **ES modules only:** `import` / `export`, never `require`. Use `import type` for type-only imports.
- **Components:** PascalCase filenames, named exports preferred.
- **Server Actions** go in `src/lib/actions/` — keep them out of components.
- **UI primitives** in `src/components/ui/` are shadcn-generated. **Don't modify them.** Override via `className`.
- **Page pattern:** server component `page.tsx` imports a client component named `*-client.tsx`. Don't put client-side logic in `page.tsx`.
- **Route groups:** `(public)` for marketing/content, `(auth)` for login flows, `(dashboard)` for members, `(admin)` for admin.
- **Forms:** React Hook Form + Zod. Always validate with Zod on submit.
- **Supabase clients:** `client.ts` (browser), `server.ts` (server components/actions), `admin.ts` (service-role, only when you need to bypass RLS).
- **Migrations:** add new SQL files under `supabase/migrations/` with a sequential numeric prefix. The maintainer applies them.

## Before pushing

```bash
npm run lint
npm run test
npm run build
```

All three must pass. The build catches type errors that `tsc` alone may miss in App Router code.

## What to avoid

- Don't commit `.env.local` or anything with secrets.
- Don't add dependencies casually — open a discussion first if the dep is non-trivial.
- Don't rename or restructure files outside your PR's stated scope.
- Don't skip Zod validation on form submissions.

## Questions

Ping the maintainer on the PR. Faster than guessing.
