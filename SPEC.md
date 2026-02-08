# ShermBowl PropBets - Technical Spec

## Overview

A mobile-first web app for a Super Bowl prop bet contest among friends. Users visit a shared link, enter their name, make picks on 25+ props with real sportsbook odds, and watch a live-updating leaderboard with animations during the game.

**Super Bowl LX**: New England Patriots vs Seattle Seahawks — Sunday, Feb 8, 2026
**Group size**: 8-12 people
**Buy-in**: $50/person (handled externally via Venmo — not tracked in-app)

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router) | SSR, API routes, fast deploys to Vercel |
| Hosting | Vercel (free tier) | 100GB bandwidth, serverless functions, instant deploy |
| Database + Realtime | Supabase (free tier) | Postgres + Realtime subscriptions. 500MB DB, 200 concurrent connections. Perfect for ~15 users. |
| Styling | Tailwind CSS v4 | Utility-first, dark mode native, fast to build |
| Animations | Framer Motion | Smooth leaderboard transitions, confetti, prop resolve animations |
| Live Game Data | ESPN API (unofficial, free) | Polling every 20s. Box score, player stats, play-by-play. ~15-30s behind live TV. |
| Odds/Lines | The Odds API (free tier) | 500 requests/month. Pull props + odds once pre-game. One-time fetch uses ~5-10 credits. |
| Deployment | Vercel CLI / GitHub push | `vercel --prod` or push to main |

### API Details

**ESPN API** (free, no auth, unofficial but stable):
- Scoreboard: `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- Game summary: `site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={eventId}`
- Returns: box score, player stats (passing, rushing, receiving, defensive), drive summaries, play-by-play
- Polling rate: every 20 seconds during game
- Typical delay: 15-30 seconds behind live broadcast

**The Odds API** (free tier, 500 credits/month):
- Endpoint: `api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?markets=player_pass_tds,player_rush_yds,...`
- Markets: spreads, totals, h2h, player props (pass TDs, rush yds, etc.), game props
- Usage: Pull all Super Bowl props once pre-game (~5-10 credits). No need to poll during game.
- Fun props (Gatorade color, anthem length, coin toss) may be available as specials — if not, commissioner adds manually with sourced odds.

**Free tier is sufficient.** For ~15 users and one game, both ESPN polling and The Odds API free tier are more than enough. No paid tier needed.

---

## Scoring System: Odds-Based Payout Points

Every prop has real American odds sourced from sportsbooks. Correct picks earn points based on the payout those odds imply. Wrong picks earn 0.

### How It Works

Each prop is like a virtual $100 bet. Your "payout" in points:

| Odds | If Correct | Explanation |
|------|-----------|-------------|
| -200 (heavy favorite) | 1.50 pts | Low reward — everyone expects this |
| -110 (coin flip) | 1.91 pts | Near even odds |
| +100 (even) | 2.00 pts | True 50/50 |
| +150 (slight underdog) | 2.50 pts | Modest reward |
| +300 (underdog) | 4.00 pts | Big reward for a bold call |
| +1000 (long shot) | 11.00 pts | Huge reward if you nail it |

### Formula

```
For positive odds (+X):  points = (X / 100) + 1
For negative odds (-X):  points = (100 / X) + 1
If wrong:                 points = 0
```

### Why This Works

- **Self-balancing**: Favorites are worth less, upsets are worth more — automatically
- **Non-debatable**: Odds come from real sportsbooks, math is simple
- **Strategic**: Do you play it safe with favorites, or swing for the fences on underdogs?
- **Universally understood**: This is exactly how sports betting payouts work

### Display to Users

Each prop shows:
```
Will there be a safety?
  YES (+650)  →  7.50 pts if correct
  NO  (-1200) →  1.08 pts if correct
```

Users see exactly what each pick is worth before they lock in. No hidden math.

---

## Prop Bet Categories (~25-30 total)

### Game Props (~8-10)
- Game winner (moneyline)
- Spread (e.g., Patriots +2.5)
- Total points over/under
- First team to score
- First scoring play type (TD/FG/Safety)
- Will there be a lead change in Q4?
- Total turnovers over/under
- Longest TD over/under

### Player Props (~10-12)
- MVP winner (multi-choice)
- First TD scorer (multi-choice)
- QB1 passing yards over/under
- QB2 passing yards over/under
- QB1 passing TDs over/under
- QB2 passing TDs over/under
- Top rusher yards over/under
- Top receiver yards over/under
- Any defensive/ST touchdown? (yes/no)
- QB1 interceptions over/under

### Fun/Novelty Props (~5-8)
- Coin toss (heads/tails)
- National anthem over/under (time)
- Gatorade bath color (multi-choice)
- Will a coach's challenge be successful? (yes/no)
- First commercial brand shown (multi-choice, if available)
- Halftime performer song count over/under
- Will any player be ejected? (yes/no)

### Sourcing Priority
1. Pull from The Odds API (player props + game props with real odds)
2. For novelty props not on API, commissioner sources odds from major sportsbooks (DraftKings, FanDuel) and enters manually
3. All props must have American odds attached before the sheet goes live

---

## User Flow

### 1. Entry (Pre-Game)

```
[iMessage link] → shermbowl.vercel.app

Landing page:
┌─────────────────────────────┐
│     🏈 SHERMBOWL PROPBETS    │
│   Patriots vs Seahawks       │
│   Super Bowl LX              │
│                              │
│   Enter your name:           │
│   [________________] [JOIN]  │
│                              │
│   12 players joined          │
│   Picks lock at 3:25 PM PT   │
└─────────────────────────────┘
```

- No login, no password, no code
- Just enter name → start picking
- Name stored in cookie so they can return to edit picks before lock

### 2. Pick Sheet (Pre-Game)

```
┌─────────────────────────────┐
│  GAME PROPS           4/10  │
│ ─────────────────────────── │
│  Game Winner                │
│  ┌─────────┐ ┌───────────┐ │
│  │ PAT -110│ │ SEA -110  │ │
│  │ 1.91pts │ │ 1.91pts   │ │
│  └─────────┘ └───────────┘ │
│                             │
│  Total Points               │
│  ┌──────────┐ ┌──────────┐ │
│  │OVER 47.5 │ │UNDER 47.5│ │
│  │-110 1.91 │ │-110 1.91 │ │
│  └──────────┘ └──────────┘ │
│                             │
│  First TD Scorer            │
│  ┌─────────┐ ┌───────────┐ │
│  │D.Henry  │ │ J.Smith   │ │
│  │+600 7.0 │ │ +800 9.0  │ │
│  ├─────────┤ ├───────────┤ │
│  │K.Bourne │ │ Field     │ │
│  │+900 10.0│ │ +200 3.0  │ │
│  └─────────┘ └───────────┘ │
│                             │
│  ── Progress: 18/27 ──────  │
│  [LOCK IN MY PICKS]         │
└─────────────────────────────┘
```

- Scrollable categories with progress tracker
- Each option shows odds + point value
- Sticky bottom bar: progress count + submit button
- Can change picks until lock time
- Props without a pick are scored as 0 (no penalty, just missed opportunity)

### 3. Waiting Room (Post-Lock, Pre-Kickoff)

```
┌─────────────────────────────┐
│  PICKS LOCKED 🔒             │
│                              │
│  Your picks: 27/27 ✓        │
│  [View My Picks]             │
│                              │
│  11 of 12 players locked in  │
│  │ Sam ✓ │ Mike ✓ │ Jake ✓  │
│  │ Dan ✓ │ ...              │
│                              │
│  Kickoff in 4:32             │
│  Live tracking starts then → │
└─────────────────────────────┘
```

- Shows who has/hasn't submitted
- Can review your own picks (read-only)
- Can't see others' picks until game starts
- Countdown to kickoff

### 4. Live Dashboard (During Game)

This is the main event. Three views accessible via bottom tabs:

#### Tab 1: Leaderboard

```
┌─────────────────────────────┐
│  LIVE LEADERBOARD      Q2   │
│  PAT 10 - SEA 7    5:42    │
│ ─────────────────────────── │
│  🥇 1. Sam      48.3 pts   │
│     ▲2  +4.5 last resolve   │
│  🥈 2. Mike     45.1 pts   │
│     ─   +0.0                │
│  🥉 3. Jake     42.8 pts   │
│     ▼1  +2.5 last resolve   │
│  4. Dan         41.2 pts   │
│  5. Chris       38.9 pts   │
│  ...                        │
│                              │
│  Max possible: Sam 127.4    │
│  Props resolved: 8/27       │
│ ─────────────────────────── │
│  [Leaderboard] [Props] [Me] │
└─────────────────────────────┘
```

- Auto-updates via Supabase Realtime (instant push, no manual refresh)
- Animated rank changes (slide up/down with Framer Motion)
- Shows rank change arrows (up/down/steady)
- Points earned on last resolved prop
- "Max possible" score (current points + all remaining props if correct)
- Confetti animation when a prop resolves and causes a lead change

#### Tab 2: Props Tracker

```
┌─────────────────────────────┐
│  PROPS TRACKER         Q2   │
│ ─────────────────────────── │
│  ✅ RESOLVED (8)            │
│  ┌───────────────────────┐  │
│  │ Coin Toss: HEADS ✓    │  │
│  │ You: Heads (2.0 pts)  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ First Score: SEA TD ✓  │  │
│  │ You: PAT FG (0 pts) ✗ │  │
│  └───────────────────────┘  │
│                              │
│  📊 IN PROGRESS (6)         │
│  ┌───────────────────────┐  │
│  │ Mahomes Pass Yds      │  │
│  │ O/U 275.5             │  │
│  │ Current: 142 yds      │  │
│  │ ██████░░░░░░ 52%      │  │
│  │ Pace: 284 → OVER      │  │
│  │ You picked: OVER ✓    │  │
│  └───────────────────────┘  │
│                              │
│  🔒 PENDING (13)            │
│  Gatorade Color, MVP, ...   │
│ ─────────────────────────── │
│  [Leaderboard] [Props] [Me] │
└─────────────────────────────┘
```

- Three sections: Resolved, In Progress, Pending
- Resolved props show result + your pick + points earned (green ✓ or red ✗)
- In-progress props show real-time stat tracking with progress bars and pace projections
- Pending props greyed out until they become trackable
- Auto-resolves stat-based props when game state makes them final

#### Tab 3: My Picks

```
┌─────────────────────────────┐
│  MY PICKS — SAM        Q2   │
│  Current: 48.3 pts (1st)    │
│  Correct: 6/8 resolved      │
│ ─────────────────────────── │
│  ✅ Coin Toss               │
│     Heads (+100) → 2.0 pts  │
│  ✗  First to Score          │
│     PAT FG (+150) → 0 pts   │
│  ✅ Game Winner              │
│     PAT (-110) → pending    │
│  📊 Mahomes O/U 275.5       │
│     OVER (-110) → tracking  │
│  ...                        │
│                              │
│  Potential: 127.4 pts max   │
│ ─────────────────────────── │
│  [Leaderboard] [Props] [Me] │
└─────────────────────────────┘
```

- All your picks listed with status
- Running point total
- Shows max potential score

---

## Real-Time Architecture

```
┌─────────────────────────────────────────────────┐
│                  DURING GAME                     │
│                                                  │
│  Vercel Cron (every 20s)                        │
│       │                                          │
│       ▼                                          │
│  API Route: /api/poll-game                      │
│       │                                          │
│       ├─→ Fetch ESPN API (game summary)         │
│       │                                          │
│       ├─→ Parse stats, check prop resolutions   │
│       │                                          │
│       ├─→ Update Supabase:                      │
│       │     • game_state (score, clock, stats)  │
│       │     • props (status, result, resolved)  │
│       │     • scores (recalculate all users)    │
│       │                                          │
│       ▼                                          │
│  Supabase Realtime                              │
│       │                                          │
│       ├─→ Push to Client A (Sam's iPhone)       │
│       ├─→ Push to Client B (Mike's iPhone)      │
│       ├─→ Push to Client C (Jake's iPhone)      │
│       └─→ ... all connected clients             │
│                                                  │
│  Client receives update → Framer Motion animates│
│  leaderboard reorder, prop status changes, etc. │
└─────────────────────────────────────────────────┘
```

### Polling Strategy
- **Pre-game**: Poll every 60s (just checking game status)
- **During game**: Poll every 20s (live stats)
- **Halftime**: Poll every 60s
- **Post-game**: Poll once, then stop. Commissioner resolves remaining props manually.

### Prop Resolution Logic

**Auto-resolved** (from ESPN data):
- Game winner, spread, total points → from final score
- Player passing/rushing/receiving yards → from box score
- First team to score → from scoring plays
- TDs, interceptions, turnovers → from box score
- First scoring play type → from play-by-play

**Commissioner-resolved** (manual):
- Coin toss result
- National anthem time
- Gatorade color
- Halftime show details
- MVP (announced post-game, commissioner enters)
- Any prop not derivable from ESPN data

Commissioner has an admin panel (accessed via `/admin?key={secret}`) to manually resolve props.

---

## Database Schema (Supabase)

### `players`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Unique, entered by user |
| created_at | timestamptz | |
| total_points | numeric | Cached, recalculated on prop resolve |
| rank | int | Cached, recalculated on prop resolve |
| max_possible | numeric | Cached — points if all remaining picks correct |
| picks_count | int | How many props they've picked |

### `props`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| category | text | 'game', 'player', 'fun' |
| question | text | e.g., "Total Points" |
| prop_type | text | 'binary', 'over_under', 'multi_choice' |
| options | jsonb | Array of {label, odds, value} |
| status | text | 'pending', 'in_progress', 'resolved' |
| result | text | Winning option value (null until resolved) |
| sort_order | int | Display order |
| stat_key | text | ESPN stat mapping for auto-resolve, null for manual |
| current_value | numeric | Live stat value for in-progress tracking |
| threshold | numeric | For O/U props, the line |
| auto_resolve | boolean | Can ESPN data resolve this? |

### `picks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| player_id | uuid | FK → players |
| prop_id | uuid | FK → props |
| selection | text | The option value they chose |
| points_earned | numeric | Filled when prop resolves |
| is_correct | boolean | Filled when prop resolves |
| created_at | timestamptz | |
| UNIQUE(player_id, prop_id) | | One pick per prop per player |

### `game_state`
| Column | Type | Notes |
|--------|------|-------|
| id | int | Always 1 (singleton) |
| home_team | text | 'SEA' |
| away_team | text | 'NE' |
| home_score | int | |
| away_score | int | |
| quarter | int | 0=pre, 1-4, 5=OT |
| clock | text | '5:42' |
| status | text | 'pre', 'in_progress', 'halftime', 'final' |
| last_play | text | Description of last play |
| updated_at | timestamptz | |

---

## Pages / Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page — enter name, join contest |
| `/picks` | Pick sheet — make selections (pre-lock only) |
| `/waiting` | Post-lock waiting room with countdown |
| `/live` | Live dashboard with 3 tabs (leaderboard, props, my picks) |
| `/admin?key={secret}` | Commissioner panel — resolve props, manage game |
| `/api/poll-game` | Cron-triggered: fetch ESPN, update state |
| `/api/resolve-prop` | Admin: manually resolve a prop |
| `/api/seed-props` | One-time: seed props from The Odds API |

### Page Transitions
- Pre-lock: `/` → `/picks` → can edit freely
- At lock time: `/picks` auto-redirects to `/waiting`
- At kickoff: `/waiting` auto-redirects to `/live`
- All transitions handled by checking `game_state.status` + lock time

---

## Commissioner Admin Panel

Accessed at `/admin?key={ADMIN_SECRET}` (secret set as env var).

Features:
- **Resolve any prop manually**: Dropdown of options, click to resolve
- **Override auto-resolution**: If ESPN data is wrong, override
- **Add/edit props**: Last-minute prop additions before lock
- **View all players' picks**: Full grid view
- **Force refresh**: Manually trigger ESPN poll
- **Game status override**: Mark halftime, game final, etc.

---

## UI/UX Design

### Visual Style
- **Dark mode sportsbook aesthetic** — dark gray/navy background, bright accent colors
- Color palette: `bg-gray-950`, `bg-gray-900`, accents in electric green (#00FF87) and gold (#FFD700)
- Typography: System font stack, bold numbers, monospace for odds
- Cards with subtle borders and glass-morphism effects
- Team colors used sparingly (Patriots navy/red, Seahawks green/blue)

### Animations (Framer Motion)
- **Leaderboard reorder**: `layout` animation — rows smoothly slide to new positions
- **Prop resolve**: Card flips or expands with result, green glow for correct, red for wrong
- **Confetti**: Fires when a big upset hits or lead changes on leaderboard
- **Score ticker**: Animating number counters for point totals
- **Progress bars**: Smooth fill animation for in-progress O/U props
- **Entry animations**: Cards fade/slide in on page load

### Mobile-First
- All layouts designed for iPhone width first (375-430px)
- Bottom tab navigation (thumb-friendly)
- Large tap targets for pick buttons (min 48px)
- Pull-to-refresh as backup for real-time
- No horizontal scrolling
- Sticky headers for score bar

---

## Lock Time Logic

- **Lock time**: 5 minutes before kickoff (configurable in env)
- Kickoff time stored in `game_state` or env var
- Client polls lock status; at lock time:
  - Pick buttons become disabled
  - Unsubmitted picks saved automatically
  - Redirect to waiting room
  - Others' picks become visible on the live dashboard

---

## File Structure

```
shermbowl/
├── SPEC.md                          # This file
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local                       # Supabase URL/key, admin secret, game config
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout, dark mode, fonts
│   │   ├── page.tsx                 # Landing — name entry
│   │   ├── picks/
│   │   │   └── page.tsx             # Pick sheet
│   │   ├── waiting/
│   │   │   └── page.tsx             # Post-lock waiting room
│   │   ├── live/
│   │   │   └── page.tsx             # Live dashboard (3 tabs)
│   │   ├── admin/
│   │   │   └── page.tsx             # Commissioner panel
│   │   └── api/
│   │       ├── poll-game/
│   │       │   └── route.ts         # ESPN polling + prop resolution
│   │       ├── resolve-prop/
│   │       │   └── route.ts         # Manual prop resolution
│   │       ├── seed-props/
│   │       │   └── route.ts         # Pull props from The Odds API
│   │       ├── players/
│   │       │   └── route.ts         # Create/get players
│   │       └── picks/
│   │           └── route.ts         # Submit/update picks
│   ├── components/
│   │   ├── Leaderboard.tsx          # Animated leaderboard
│   │   ├── PropCard.tsx             # Individual prop bet card
│   │   ├── PropTracker.tsx          # In-progress prop with live stats
│   │   ├── PickButton.tsx           # Selectable option button with odds
│   │   ├── ScoreBar.tsx             # Sticky game score header
│   │   ├── ConfettiOverlay.tsx      # Confetti animation component
│   │   ├── CountdownTimer.tsx       # Kickoff countdown
│   │   ├── ProgressRing.tsx         # Circular progress for pick completion
│   │   └── TabNav.tsx               # Bottom tab navigation
│   ├── lib/
│   │   ├── supabase.ts              # Supabase client + realtime setup
│   │   ├── espn.ts                  # ESPN API fetching + parsing
│   │   ├── odds.ts                  # The Odds API integration
│   │   ├── scoring.ts               # Points calculation from odds
│   │   ├── resolver.ts              # Auto-resolve logic: ESPN data → prop results
│   │   └── types.ts                 # TypeScript types
│   └── hooks/
│       ├── useRealtimeLeaderboard.ts  # Supabase subscription for leaderboard
│       ├── useRealtimeProps.ts        # Supabase subscription for prop updates
│       └── useGameState.ts            # Supabase subscription for game state
├── supabase/
│   └── migrations/
│       └── 001_initial.sql          # Schema creation
└── scripts/
    └── seed-props.ts                # CLI script to seed props from API
```

---

## Deployment Checklist

1. Create Supabase project (free tier)
2. Run migration to create tables
3. Set env vars on Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_SECRET`
   - `THE_ODDS_API_KEY`
   - `ESPN_EVENT_ID` (Super Bowl LX event ID)
   - `LOCK_TIME` (ISO string, 5 min before kickoff)
   - `KICKOFF_TIME` (ISO string)
4. Run `seed-props` script to pull odds and populate props table
5. Commissioner reviews/adjusts props in admin panel
6. Deploy to Vercel: `vercel --prod`
7. Share link in group text: `shermbowl.vercel.app`
8. During game: app auto-polls ESPN and updates everything
9. Post-game: commissioner resolves remaining manual props in admin panel

---

## MCP Setup (for Claude Code deployment assistance)

### Supabase MCP

Add to your `.mcp.json` so Claude Code can create tables, run migrations, and manage the DB directly:

```json
"supabase": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp"
}
```

On first use, it will prompt you to authenticate via browser with your Supabase account.

**Capabilities**: Create projects, list tables, run SQL, apply migrations, generate types, manage edge functions.

**Your setup steps**:
1. Create a free Supabase account at [supabase.com](https://supabase.com) (use samuelksherman@gmail.com)
2. Add the MCP entry above to `~/projects/home/.mcp.json`
3. Restart Claude Code
4. Claude Code can then create the project, run migrations, and configure everything via MCP

### Vercel (CLI-based, no MCP needed)

Vercel doesn't have an official MCP server, but the Vercel CLI is simple enough:

**Your setup steps**:
1. Create a free Vercel account at [vercel.com](https://vercel.com) (use samuelksherman@gmail.com or GitHub login)
2. Install CLI: `npm i -g vercel`
3. Run `vercel login` once
4. Claude Code deploys via `vercel --prod` in bash

### The Odds API

**Your setup steps**:
1. Sign up at [the-odds-api.com](https://the-odds-api.com) (free, 500 credits/month)
2. Copy your API key
3. Set it as `THE_ODDS_API_KEY` in `.env.local`

### What You Need to Do (total)

| Step | Action | Where |
|------|--------|-------|
| 1 | Create Supabase account | supabase.com |
| 2 | Create Vercel account | vercel.com |
| 3 | Sign up for The Odds API | the-odds-api.com |
| 4 | Add Supabase MCP to `.mcp.json` | Claude Code config |
| 5 | Run `vercel login` | Terminal |
| 6 | Give me the API keys | Claude Code session |

After that, Claude Code handles everything else: project creation, DB setup, deployment, and prop seeding.

---

## Edge Cases & Handling

| Scenario | Handling |
|----------|---------|
| User joins after lock time | Can view leaderboard but can't pick — shown "Picks are locked" |
| Duplicate names | Reject with "Name taken, try another" |
| User closes app mid-game | Reconnects via Supabase Realtime on reopen. Cookie remembers identity. |
| ESPN API down | Last known state preserved. Commissioner can manually update. Banner shows "Live data delayed." |
| Overtime | Continue polling. Props with "regulation" qualifier resolve at end of Q4. |
| Prop result disputed | Commissioner has final say via admin panel. Odds were set pre-game. |
| User doesn't pick all props | Unpicked props = 0 points. No penalty. |
| Tie in final standings | Both players share the rank. |

---

## Summary

- **For users**: Open link → type name → tap picks → watch live leaderboard during game
- **For commissioner (you)**: Seed props → share link → resolve manual props during/after game
- **Tech**: Next.js + Supabase + ESPN API. All free tier. Real-time push updates. Dark sportsbook UI with animations.
