# ShermBowl

Super Bowl prop bet app for a friends group. Pick props before kickoff, watch the leaderboard update live during the game.

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **Supabase** (Postgres + Realtime subscriptions)
- **Vercel** (hosting + serverless functions)
- **ESPN API** (live game data, polled every 20s)
- **The Odds API** (pre-game odds/lines)
- **Google Sheets API** (optional live backup)

## Features

- Mobile-first dark UI with animations (Framer Motion)
- 21 curated props across game, player, fun, and degen categories
- Real sportsbook odds converted to point values
- Auto-resolving props from live ESPN data
- Projected + confirmed scoring with real-time leaderboard
- Admin panel for game control, manual resolution, and mock game simulation
- Shareable invite links with OpenGraph images
- Google Sheets sync for external backup

## Setup

```bash
npm install
cp .env.example .env.local  # fill in your keys
npm run dev
```

### Required env vars

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `ADMIN_SECRET` | Secret for admin panel + API endpoints |
| `THE_ODDS_API_KEY` | [The Odds API](https://the-odds-api.com/) key |
| `NEXT_PUBLIC_LOCK_TIME` | ISO timestamp when picks lock |
| `NEXT_PUBLIC_KICKOFF_TIME` | ISO timestamp for kickoff |

### Optional env vars (Google Sheets sync)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth refresh token |
| `GOOGLE_SHEET_ID` | Target spreadsheet ID |

## Deploy

```bash
npx vercel --prod
```

## Project structure

```
src/app/           - Pages (landing, picks, live, waiting, admin, invite links)
src/app/api/       - API routes (picks, players, poll-game, resolve-prop, seed, mock-game)
src/components/    - React components (PropCard, Leaderboard, LiveStatBar, etc.)
src/lib/           - Shared utils (supabase client, types, scoring, ESPN, resolver)
e2e/               - Playwright E2E tests
supabase/          - SQL migrations (run manually in Supabase Dashboard)
```

## License

MIT
