export interface Player {
  id: string;
  name: string;
  created_at: string;
  total_points: number;
  rank: number;
  max_possible: number;
  picks_count: number;
}

export interface PropOption {
  label: string;
  odds: number; // American odds, e.g. +150, -110
  value: string; // unique identifier for this option
}

export interface Prop {
  id: string;
  name: string | null;
  category: "game" | "player" | "fun" | "degen";
  question: string;
  prop_type: "binary" | "over_under" | "multi_choice";
  options: PropOption[];
  status: "pending" | "in_progress" | "resolved";
  result: string | null;
  sort_order: number;
  stat_key: string | null;
  current_value: number | null;
  threshold: number | null;
  auto_resolve: boolean;
  resolution_criteria: string | null;
  live_stats: Record<string, unknown> | null;
  player_name: string | null;
}

export interface Pick {
  id: string;
  player_id: string;
  prop_id: string;
  selection: string;
  points_earned: number | null;
  is_correct: boolean | null;
  created_at: string;
}

export interface GameState {
  id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  quarter: number;
  clock: string;
  status: "pre" | "in_progress" | "halftime" | "final";
  last_play: string | null;
  updated_at: string;
}

export interface LeaderboardEntry {
  player_id: string;
  name: string;
  total_points: number;
  rank: number;
  prev_rank: number | null;
  max_possible: number;
  correct_count: number;
  resolved_count: number;
  last_points: number | null;
}

// Scoring helpers
export function oddsToPoints(odds: number): number {
  if (odds > 0) {
    return odds / 100 + 1;
  } else {
    return 100 / Math.abs(odds) + 1;
  }
}

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatPoints(points: number): string {
  return points.toFixed(2);
}

export function getQuarterLabel(quarter: number): string {
  if (quarter === 0) return "PRE";
  if (quarter <= 4) return `Q${quarter}`;
  return "OT";
}
