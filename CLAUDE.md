# ShermBowl PropBets

Super Bowl prop bet app for the Hot Sauc Boyz group. Next.js 16 + Supabase + Vercel.

## Quick Reference

| Service | Detail |
|---------|--------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| React | 19.x (breaking changes from 18 — see below) |
| DB | Supabase (see env vars for project URL) |
| Hosting | Vercel (`shermbowl.vercel.app`) |
| E2E Tests | Playwright (runs against deployed Vercel site, NOT localhost) |

## Commands

```bash
npm run dev          # Local dev server
npm run build        # Production build (TypeScript check included)
npx vercel --prod    # Deploy to production
npx playwright test  # E2E tests (MUST deploy first — tests hit shermbowl.vercel.app)
```

## Supabase Constraints (CRITICAL)

### No Direct DB Access
The Supabase free tier DB is **IPv6-only**. Neither the local machine nor Vercel serverless can resolve `db.{ref}.supabase.co`. The pooler (`aws-0-{region}.pooler.supabase.com`) returns "Tenant or user not found" for all regions tried. **There is currently no programmatic way to run DDL (ALTER TABLE, CREATE FUNCTION, etc.) against this database.**

### What DOES Work
- **Supabase REST API (PostgREST)** via `@supabase/supabase-js` — table CRUD, RPC calls
- **Supabase Realtime** — subscriptions to table changes
- The JS client with the service role key has full row-level access

### What Does NOT Work
- Direct `pg` connections (ENOTFOUND / EHOSTUNREACH)
- Connection pooler (tenant not found — correct pooler URL unknown)
- Supabase Management API (`api.supabase.com`) — requires personal access token, not service role key
- Supabase CLI (`supabase link`) — requires interactive TTY login
- HTTP SQL endpoints (`/pg/query`, `/pg-meta/query`) — return 404

### Schema Changes Require Manual SQL
Any DDL (ALTER TABLE, CREATE INDEX, etc.) must be run manually in the **Supabase Dashboard > SQL Editor**. Store migration SQL in `supabase/migrations/` for reference, but these cannot be applied programmatically.

### Current Schema Gap
The `props` table is missing columns: `name`, `resolution_criteria`, `live_stats`. The category constraint doesn't include `'degen'`. Migration SQL is in `supabase/migrations/002_add_missing_columns.sql`. Until this runs, the seed endpoint must skip these columns.

### Workaround Pattern for Missing Columns
When columns might not exist, the seed/insert code should:
1. Try the full insert first
2. On failure, detect which columns are missing (PostgREST returns error code 42703)
3. Retry without the missing columns
4. Report what's missing in the response

## Vercel Constraints

### Deploy Before Testing
Playwright tests target `shermbowl.vercel.app`. Always `npx vercel --prod` before running E2E tests. Running tests against stale deployments wastes time.

### Env Vars
Env vars must be added per-environment (development, preview, production):
```bash
echo "value" | npx vercel env add VAR_NAME production --yes
```
Current env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`, `SUPABASE_DB_PASSWORD`, `THE_ODDS_API_KEY`, `NEXT_PUBLIC_LOCK_TIME`, `NEXT_PUBLIC_KICKOFF_TIME`, team config vars.

### Serverless Cannot Reach Supabase DB
Vercel serverless functions also cannot resolve the Supabase direct connection hostname. Do NOT create API routes that try to use `pg` for direct DB connections — they will fail in production.

## React 19 Gotchas

- `useRef()` requires an initial argument: `useRef<Type>(undefined)` or `useRef<Type>(null)`. Omitting the argument causes TS2554.
- StrictMode double-renders in dev (not new, but worth noting).

## Project Structure

```
src/app/           — Next.js App Router pages
src/app/api/       — API routes (picks, players, poll-game, resolve-prop, seed-curated, mock-game)
src/components/    — React components (PropCard, PickButton, Leaderboard, LiveStatBar, etc.)
src/lib/           — Shared utils (supabase client, types, scoring, ESPN, resolver)
e2e/               — Playwright E2E tests
supabase/migrations/ — SQL migration files (run manually in Dashboard)
```

## Admin

- Admin panel: `/admin?key=$ADMIN_SECRET`
- Seed props: POST `/api/seed-curated` with `{"key":"$ADMIN_SECRET"}`
- Mock game: POST `/api/mock-game` with `{"key":"$ADMIN_SECRET","step":1}`
- Backup picks: GET `/api/backup-picks?key=$ADMIN_SECRET`
- Admin secret: stored in `ADMIN_SECRET` env var (see Vercel / .env.local)

## Google Sheets Backup

- Sheet: https://docs.google.com/spreadsheets/d/17NcpJsQyTTZXxzOpse1mJhcGMi2tldP39WtQ9vxnQa4/edit
- Tabs: Picks, Props, Players, Game Log
- Props tab pre-populated with all 21 props
- Use `/api/backup-picks` endpoint to get formatted data for syncing
- Use google-workspace MCP tools (samuel.k.sherman@gmail.com) to write data

## Cleaned Up

- Removed `src/app/api/run-migration/route.ts` (dead code — programmatic migration never worked)
- Removed `pg` and `@types/pg` from package.json (direct DB connections don't work on free tier)
- Removed `src/components/Leaderboard.tsx` and `src/hooks/useRealtimeLeaderboard.ts` (dead code — replaced by `ProjectedLeaderboard.tsx`)
