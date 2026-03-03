# node_v0

Burning Man camp web app — handles applications, member registration, photo galleries, vibes/content pages, and admin dashboard. Auth via Supabase, data stored in Supabase + Google Sheets integration.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Auth:** Supabase Auth (email magic link / OTP) with middleware session refresh
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS v4, shadcn/ui (Radix primitives), Framer Motion
- **Forms:** React Hook Form + Zod validation
- **Testing:** Vitest
- **Deploy:** Vercel

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Test (prefer single files)
npm run test -- src/lib/actions/__tests__/applications.test.ts

# Full test suite
npm run test
```

## Code Style

- ES modules throughout — `import/export`, never `require`
- Use `type` for type-only imports: `import type { Foo } from 'bar'`
- Components: PascalCase files, named exports preferred
- Server Actions live in `src/lib/actions/` — keep them separate from components
- UI primitives are in `src/components/ui/` (shadcn) — don't modify these directly, override via className
- Page pattern: server component `page.tsx` imports a `*-client.tsx` client component

## Architecture

- **Route Groups:** `(public)` for marketing/content, `(auth)` for login/signup/verify, `(dashboard)` for authenticated users, `(admin)` for admin panel
- **Auth middleware** (`src/middleware.ts`) refreshes Supabase sessions on every request — check `src/lib/supabase/middleware.ts` if auth issues arise
- **Supabase clients:** `client.ts` (browser), `server.ts` (server components/actions), `admin.ts` (service role, elevated privileges)
- **Google Sheets integration** (`src/lib/google-sheets.ts`) syncs application data — treat as read-heavy, write-careful
- **Security headers** configured in `next.config.ts` — X-Frame-Options DENY, nosniff, strict referrer

## Things You Must Not Do

- Do NOT use `supabase/admin.ts` client unless you need service-role privileges — use `server.ts` for normal server operations
- Do NOT modify `src/components/ui/` files directly — these are shadcn primitives
- Do NOT put client-side logic in `page.tsx` files — use the `*-client.tsx` pattern
- Do NOT commit `.env.local` — copy from `.env.local.example`
- Do NOT skip Zod validation on form submissions

## Common Gotchas

- Supabase auth callback route is at `src/app/auth/callback/route.ts` — must match Supabase dashboard redirect URL
- Server Actions have a 50mb body size limit (configured in `next.config.ts`)
- The middleware matcher excludes static files and images — if a new static route isn't working, check the matcher regex
- Google Sheets API requires service account credentials in env vars

## Workflow

1. Explore the relevant route group before making changes
2. Plan before touching auth flow or middleware
3. Run `npm run build` after changes to catch type errors (strict mode)
4. Run `npm run test` for any changes to server actions

## When Compacting Context

Preserve: which route group is being worked on, Supabase client type being used (client/server/admin), modified file list, and any auth flow changes.
