# AGENTS.md

This repo's coding guide for AI assistants lives in [`CLAUDE.md`](./CLAUDE.md).

It applies to all AI tools — Claude Code, Cursor, Codex, Aider, Continue,
Windsurf, etc. — not just Claude. Read it first.

## Quick orientation

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase · Tailwind 4 · shadcn/ui
- **Run:** `npm run dev` · **Build:** `npm run build` · **Test:** `npm run test`
- **Pages pattern:** `page.tsx` (server) imports `*-client.tsx` (client)
- **Server actions:** live in `src/lib/actions/`, never inside components
- **Supabase clients:** `client.ts` (browser) · `server.ts` (RSC/actions) · `admin.ts` (service-role — avoid unless you need it)
- **Don't edit** `src/components/ui/` directly (shadcn primitives — override via `className`)
- **Don't commit** `.env.local` or service-role keys

For everything else — auth flow, route groups, gotchas, the full "things you must not do" list — see `CLAUDE.md`.
