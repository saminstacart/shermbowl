import type { PropOption } from "./types";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

interface OddsAPIOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface OddsAPIMarket {
  key: string;
  outcomes: OddsAPIOutcome[];
}

interface OddsAPIBookmaker {
  key: string;
  title: string;
  markets: OddsAPIMarket[];
}

interface OddsAPIEvent {
  id: string;
  bookmakers: OddsAPIBookmaker[];
}

// Markets to pull from The Odds API
const MARKETS = [
  "h2h",
  "spreads",
  "totals",
  "player_pass_yds",
  "player_pass_tds",
  "player_pass_interceptions",
  "player_pass_attempts",
  "player_pass_completions",
  "player_rush_yds",
  "player_rush_tds",
  "player_rush_attempts",
  "player_receptions",
  "player_reception_yds",
  "player_anytime_td",
  "player_1st_td",
  "player_sacks",
  "player_field_goals",
  "player_reception_tds",
].join(",");

// Pick the "best" bookmaker (prefer DraftKings, then FanDuel, then first available)
function pickBookmaker(bookmakers: OddsAPIBookmaker[]): OddsAPIBookmaker | null {
  const preferred = ["draftkings", "fanduel", "betmgm", "betrivers"];
  for (const key of preferred) {
    const found = bookmakers.find((b) => b.key === key);
    if (found) return found;
  }
  return bookmakers[0] || null;
}

function marketKeyToCategory(key: string): "game" | "player" {
  if (key.startsWith("player_")) return "player";
  return "game";
}

function marketKeyToQuestion(key: string, outcomes: OddsAPIOutcome[]): string {
  const playerName = outcomes[0]?.description || "";
  switch (key) {
    case "h2h": return "Game Winner";
    case "spreads": return "Spread";
    case "totals": return "Total Points";
    case "player_pass_yds": return `${playerName} Passing Yards`;
    case "player_pass_tds": return `${playerName} Passing TDs`;
    case "player_pass_interceptions": return `${playerName} Interceptions`;
    case "player_pass_attempts": return `${playerName} Pass Attempts`;
    case "player_pass_completions": return `${playerName} Pass Completions`;
    case "player_rush_yds": return `${playerName} Rushing Yards`;
    case "player_rush_tds": return `${playerName} Rushing TDs`;
    case "player_rush_attempts": return `${playerName} Rush Attempts`;
    case "player_receptions": return `${playerName} Receptions`;
    case "player_reception_yds": return `${playerName} Receiving Yards`;
    case "player_reception_tds": return `${playerName} Receiving TDs`;
    case "player_anytime_td": return "Anytime TD Scorer";
    case "player_1st_td": return "First TD Scorer";
    case "player_sacks": return `${playerName} Sacks`;
    case "player_field_goals": return `${playerName} Field Goals`;
    default: return key;
  }
}

function marketKeyToPropType(
  key: string
): "binary" | "over_under" | "multi_choice" {
  if (key === "h2h") return "binary";
  if (key === "player_anytime_td" || key === "player_1st_td") return "multi_choice";
  if (key.startsWith("player_")) return "over_under";
  if (key === "spreads" || key === "totals") return "over_under";
  return "binary";
}

function marketKeyToStatKey(key: string): string | null {
  const mapping: Record<string, string> = {
    player_pass_yds: "passYds",
    player_pass_tds: "passTds",
    player_pass_interceptions: "interceptions",
    player_pass_attempts: "passAttempts",
    player_pass_completions: "passCompletions",
    player_rush_yds: "rushYds",
    player_rush_tds: "rushTds",
    player_rush_attempts: "rushAttempts",
    player_receptions: "receptions",
    player_reception_yds: "recYds",
    player_reception_tds: "recTds",
    player_sacks: "sacks",
    player_field_goals: "fieldGoals",
  };
  return mapping[key] || null;
}

interface SeedProp {
  category: "game" | "player" | "fun";
  question: string;
  prop_type: "binary" | "over_under" | "multi_choice";
  options: PropOption[];
  sort_order: number;
  stat_key: string | null;
  threshold: number | null;
  auto_resolve: boolean;
  player_name: string | null;
}

export async function fetchSuperBowlProps(
  apiKey: string,
  eventId: string
): Promise<SeedProp[]> {
  const url = `${ODDS_API_BASE}/sports/americanfootball_nfl/events/${eventId}/odds?apiKey=${apiKey}&regions=us&oddsFormat=american&markets=${MARKETS}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Odds API error ${res.status}: ${text}`);
  }

  const data: OddsAPIEvent = await res.json();
  const bookmaker = pickBookmaker(data.bookmakers);
  if (!bookmaker) throw new Error("No bookmakers found");

  const props: SeedProp[] = [];
  let sortOrder = 0;

  // Group multi-choice markets (anytime TD, first TD) into single props
  const multiChoiceAccumulator: Record<string, PropOption[]> = {};

  for (const market of bookmaker.markets) {
    const key = market.key;
    const propType = marketKeyToPropType(key);

    if (propType === "multi_choice") {
      // Accumulate outcomes for multi-choice props
      if (!multiChoiceAccumulator[key]) {
        multiChoiceAccumulator[key] = [];
      }
      for (const outcome of market.outcomes) {
        multiChoiceAccumulator[key].push({
          label: outcome.name,
          odds: outcome.price,
          value: outcome.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        });
      }
      continue;
    }

    if (propType === "over_under") {
      // Group by player for player props
      const playerGroups = new Map<string, OddsAPIOutcome[]>();
      for (const outcome of market.outcomes) {
        const playerKey = outcome.description || "game";
        const existing = playerGroups.get(playerKey) || [];
        existing.push(outcome);
        playerGroups.set(playerKey, existing);
      }

      for (const [, outcomes] of playerGroups) {
        const overOutcome = outcomes.find((o) => o.name === "Over");
        const underOutcome = outcomes.find((o) => o.name === "Under");
        if (!overOutcome || !underOutcome) continue;

        const threshold = overOutcome.point ?? underOutcome.point ?? 0;
        const question = marketKeyToQuestion(key, outcomes);

        sortOrder++;
        props.push({
          category: marketKeyToCategory(key),
          question,
          prop_type: "over_under",
          options: [
            {
              label: `Over ${threshold}`,
              odds: overOutcome.price,
              value: "over",
            },
            {
              label: `Under ${threshold}`,
              odds: underOutcome.price,
              value: "under",
            },
          ],
          sort_order: sortOrder,
          stat_key: marketKeyToStatKey(key),
          threshold,
          auto_resolve: key !== "spreads" && key !== "totals"
            ? !!marketKeyToStatKey(key)
            : true,
          player_name: outcomes[0]?.description || null,
        });
      }
    } else if (propType === "binary" && key === "h2h") {
      sortOrder++;
      const options: PropOption[] = market.outcomes.map((o) => ({
        label: o.name,
        odds: o.price,
        value: o.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      }));
      props.push({
        category: "game",
        question: "Game Winner",
        prop_type: "binary",
        options,
        sort_order: sortOrder,
        stat_key: null,
        threshold: null,
        auto_resolve: true,
        player_name: null,
      });
    }
  }

  // Add multi-choice props
  for (const [key, options] of Object.entries(multiChoiceAccumulator)) {
    sortOrder++;
    props.push({
      category: "player",
      question: marketKeyToQuestion(key, []),
      prop_type: "multi_choice",
      options: options.slice(0, 20), // Cap at 20 choices for UI sanity
      sort_order: sortOrder,
      stat_key: null,
      threshold: null,
      auto_resolve: false,
      player_name: null,
    });
  }

  // Sort: game props first, then player O/U, then multi-choice
  const categoryOrder = { game: 0, player: 1, fun: 2 };
  const typeOrder = { binary: 0, over_under: 1, multi_choice: 2 };
  props.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return typeOrder[a.prop_type] - typeOrder[b.prop_type];
  });

  // Reassign sort order after sorting
  props.forEach((p, i) => (p.sort_order = i + 1));

  return props;
}
