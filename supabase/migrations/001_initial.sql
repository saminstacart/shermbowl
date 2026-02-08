-- ShermBowl PropBets Schema

-- Game state (singleton row)
create table game_state (
  id int primary key default 1 check (id = 1),
  home_team text not null default 'SEA',
  away_team text not null default 'NE',
  home_score int not null default 0,
  away_score int not null default 0,
  quarter int not null default 0,
  clock text not null default '0:00',
  status text not null default 'pre' check (status in ('pre', 'in_progress', 'halftime', 'final')),
  last_play text,
  updated_at timestamptz not null default now()
);

-- Insert initial game state
insert into game_state (id) values (1);

-- Players
create table players (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now(),
  total_points numeric not null default 0,
  rank int not null default 0,
  max_possible numeric not null default 0,
  picks_count int not null default 0
);

-- Props
create table props (
  id uuid primary key default gen_random_uuid(),
  name text,
  category text not null check (category in ('game', 'player', 'fun', 'degen')),
  question text not null,
  prop_type text not null check (prop_type in ('binary', 'over_under', 'multi_choice')),
  options jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  result text,
  sort_order int not null default 0,
  stat_key text,
  current_value numeric,
  threshold numeric,
  auto_resolve boolean not null default false,
  player_name text,
  resolution_criteria text,
  live_stats jsonb
);

-- Picks
create table picks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  prop_id uuid not null references props(id) on delete cascade,
  selection text not null,
  points_earned numeric,
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique(player_id, prop_id)
);

-- Indexes
create index idx_picks_player on picks(player_id);
create index idx_picks_prop on picks(prop_id);
create index idx_props_status on props(status);
create index idx_props_sort on props(sort_order);

-- Enable realtime
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table props;
alter publication supabase_realtime add table picks;

-- Row level security (permissive for this app)
alter table game_state enable row level security;
alter table players enable row level security;
alter table props enable row level security;
alter table picks enable row level security;

-- Allow anyone to read everything
create policy "Public read game_state" on game_state for select using (true);
create policy "Public read players" on players for select using (true);
create policy "Public read props" on props for select using (true);
create policy "Public read picks" on picks for select using (true);

-- Allow anyone to insert/update players (they join by entering name)
create policy "Public insert players" on players for insert with check (true);
create policy "Public update players" on players for update using (true);

-- Allow anyone to insert/update picks (before lock time)
create policy "Public insert picks" on picks for insert with check (true);
create policy "Public update picks" on picks for update using (true);

-- Only service role can update game_state and props (admin/cron operations)
create policy "Service update game_state" on game_state for update using (true);
create policy "Service update props" on props for update using (true);
create policy "Service insert props" on props for insert with check (true);
