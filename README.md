# NODE

The web home of [NODE](https://node.family) — a Burning Man camp.

This is the platform behind `node.family`: applications, member registration,
volunteer jobs/shifts, photo galleries, and the admin tools that keep us
organized between burns. Currently focused on **NODE 2026**.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Supabase** — Postgres + Auth (magic-link / OTP)
- **Tailwind CSS 4** + **shadcn/ui** + **Framer Motion**
- **Resend** for transactional email
- Deployed on **Vercel** → `node.family`

## Run it locally

```bash
git clone https://github.com/jgrushack/node-platform.git
cd node-platform
npm install
cp .env.local.example .env.local   # then fill in Supabase + Resend keys
npm run dev
```

Open <http://localhost:3000>.

## Scripts

```bash
npm run dev      # next dev
npm run build    # next build (strict TS — run before pushing big changes)
npm run lint     # eslint
npm run test     # vitest
```

## Repo layout

```
src/
  app/
    (public)/     # marketing: /, /about, /vibes, /pics, /apply
    (auth)/       # /login, /signup, /verify, /auth/callback
    (dashboard)/  # member-only: /dashboard, /dashboard/jobs, /dashboard/profile
    (admin)/      # admin-only: /admin, /admin/jobs, /admin/applications, /admin/users
    api/          # route handlers
  components/
    ui/           # shadcn primitives — don't edit directly, override via className
  lib/
    actions/      # server actions (forms, mutations)
    supabase/     # client.ts (browser) · server.ts (RSC/actions) · admin.ts (service role)
    email/        # Resend templates + send helpers
supabase/
  migrations/     # numbered SQL migrations — run via Supabase MCP or CLI
public/           # static assets, fonts, gallery images
```

Pages follow a `page.tsx` (server) → `*-client.tsx` (client) split.

## Contributing

NODE campers — yes, this means you. PRs welcome.

- New to the codebase? Read [`CLAUDE.md`](./CLAUDE.md). It's the orientation
  doc for both humans and AI assistants (Claude Code, Cursor, etc.) and
  covers conventions, the auth flow, and gotchas. [`AGENTS.md`](./AGENTS.md)
  points there too for non-Claude tools.
- Run `npm run build` and `npm run test` before opening a PR.
- Keep server actions in `src/lib/actions/`. Don't put client logic in
  `page.tsx` — use the `*-client.tsx` pattern.
- Don't commit `.env.local` or service-role keys.

## License

[AGPL-3.0](./LICENSE) · © The Node Foundation

This is a network-copyleft license: if you fork this and run a modified
version as a public service, you must publish your source. See AGPL §13.
