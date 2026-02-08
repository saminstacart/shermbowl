import type { ESPNGameData, ScoringPlay } from "./espn";
import type { Prop } from "./types";

export interface ResolvedProp {
  propId: string;
  result: string;
  reason: string;
}

// ── Player name mappings ──────────────────────────────────────────────
// Maps option values to ESPN player name patterns (case-insensitive partial match)
const PLAYER_NAMES: Record<string, string[]> = {
  // QBs
  maye: ["drake maye", "d. maye"],
  darnold: ["sam darnold", "s. darnold"],
  // RBs
  walker: ["kenneth walker", "k. walker"],
  stevenson: ["rhamondre stevenson", "r. stevenson"],
  // WRs / TEs
  jsn: ["jaxon smith-njigba", "j. smith-njigba", "smith-njigba"],
  diggs: ["stefon diggs", "s. diggs"],
  kupp: ["cooper kupp", "c. kupp"],
  henry: ["hunter henry", "h. henry"],
  // TD variants
  walker_td: ["kenneth walker", "k. walker"],
  stevenson_td: ["rhamondre stevenson", "r. stevenson"],
  jsn_td: ["jaxon smith-njigba", "j. smith-njigba", "smith-njigba"],
  maye_td: ["drake maye", "d. maye"],
  darnold_td: ["sam darnold", "s. darnold"],
  diggs_td: ["stefon diggs", "s. diggs"],
  kupp_td: ["cooper kupp", "c. kupp"],
  // MVP variants
  maye_mvp: ["drake maye", "d. maye"],
  darnold_mvp: ["sam darnold", "s. darnold"],
  walker_mvp: ["kenneth walker", "k. walker"],
  stevenson_mvp: ["rhamondre stevenson", "r. stevenson"],
  jsn_mvp: ["jaxon smith-njigba", "j. smith-njigba", "smith-njigba"],
};

// Team abbreviations to option value mapping
// Update these if the ESPN abbreviations differ
const TEAM_MAP = {
  home: "seahawks",
  away: "patriots",
  // ESPN abbreviations
  SEA: "seahawks",
  NE: "patriots",
  "New England": "patriots",
  Seattle: "seahawks",
};

// ── Helpers ───────────────────────────────────────────────────────────

function findPlayerStat(
  gameData: ESPNGameData,
  optionValue: string
): { name: string; stats: ESPNGameData["playerStats"][string] } | null {
  const patterns = PLAYER_NAMES[optionValue];
  if (!patterns) return null;

  for (const [, stats] of Object.entries(gameData.playerStats)) {
    const name = stats.name.toLowerCase();
    if (patterns.some((p) => name.includes(p.toLowerCase()))) {
      return { name: stats.name, stats };
    }
  }
  return null;
}

function scoringPlayMatchesPlayer(
  play: ScoringPlay,
  optionValue: string
): boolean {
  const patterns = PLAYER_NAMES[optionValue];
  if (!patterns) return false;
  const desc = play.description.toLowerCase();
  return patterns.some((p) => desc.includes(p.toLowerCase()));
}

function getFirstScoringPlay(gameData: ESPNGameData): ScoringPlay | null {
  if (gameData.scoringPlays.length === 0) return null;
  return gameData.scoringPlays[0];
}

function getFirstTDPlay(gameData: ESPNGameData): ScoringPlay | null {
  return gameData.scoringPlays.find((p) => p.type === "TD") || null;
}

function getPointsByQuarter(
  gameData: ESPNGameData
): Record<number, number> {
  const qPoints: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const plays = gameData.scoringPlays;

  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    const q = play.quarter;
    if (q < 1 || q > 4) continue;

    // Points scored on this play = total points after - total points before
    const totalAfter = play.homeScore + play.awayScore;
    const totalBefore =
      i > 0
        ? plays[i - 1].homeScore + plays[i - 1].awayScore
        : 0;
    qPoints[q] += totalAfter - totalBefore;
  }

  return qPoints;
}

function getTotalTDs(gameData: ESPNGameData): number {
  return gameData.scoringPlays.filter((p) => p.type === "TD").length;
}

function getTotalSacks(gameData: ESPNGameData): number {
  return (
    (gameData.teamStats.home.sacks || 0) +
    (gameData.teamStats.away.sacks || 0)
  );
}

function getTotalINTs(gameData: ESPNGameData): number {
  let total = 0;
  for (const [, stats] of Object.entries(gameData.playerStats)) {
    total += stats.interceptions || 0;
  }
  return total;
}

function hasSafety(gameData: ESPNGameData): boolean {
  return gameData.scoringPlays.some((p) => p.type === "Safety");
}

function checkComebackFrom14(gameData: ESPNGameData): boolean {
  // Check if any team had a 14+ point lead and then lost
  const plays = gameData.scoringPlays;
  if (plays.length === 0) return false;

  let maxHomeLead = 0;
  let maxAwayLead = 0;

  for (const play of plays) {
    const diff = play.homeScore - play.awayScore;
    if (diff > maxHomeLead) maxHomeLead = diff;
    if (-diff > maxAwayLead) maxAwayLead = -diff;
  }

  // Final result
  const finalHome = gameData.homeScore;
  const finalAway = gameData.awayScore;

  // Home had 14+ lead but lost
  if (maxHomeLead >= 14 && finalAway > finalHome) return true;
  // Away had 14+ lead but lost
  if (maxAwayLead >= 14 && finalHome > finalAway) return true;

  return false;
}

// ── Main resolver ─────────────────────────────────────────────────────

type PropResolver = (
  prop: Prop,
  gameData: ESPNGameData
) => { result: string; reason: string } | null;

// Map sort_order to resolver functions for maximum reliability
// sort_order is stable and set by the seed
const RESOLVERS: Record<number, PropResolver> = {
  // 1: Game Winner
  1: (_prop, gameData) => {
    if (gameData.status !== "final") return null;
    const winner =
      gameData.homeScore > gameData.awayScore ? "seahawks" : "patriots";
    return {
      result: winner,
      reason: `Final score: ${gameData.awayScore}-${gameData.homeScore}`,
    };
  },

  // 2: Combined points O/U 45.5
  2: (prop, gameData) => {
    if (gameData.status !== "final") return null;
    const total = gameData.homeScore + gameData.awayScore;
    if (prop.threshold === null) return null;
    return {
      result: total > prop.threshold ? "over" : "under",
      reason: `Total points: ${total} vs line ${prop.threshold}`,
    };
  },

  // 3: Margin of victory
  3: (_prop, gameData) => {
    if (gameData.status !== "final") return null;
    const margin = Math.abs(gameData.homeScore - gameData.awayScore);
    let result: string;
    if (margin >= 19) result = "19_plus";
    else if (margin >= 13) result = "13_18";
    else if (margin >= 7) result = "7_12";
    else result = "1_6";
    return { result, reason: `Margin: ${margin} points` };
  },

  // 4: Which team scores first
  4: (_prop, gameData) => {
    const first = getFirstScoringPlay(gameData);
    if (!first) return null; // No scores yet
    const teamAbbr = first.team.toUpperCase();
    const isHome =
      teamAbbr === "SEA" ||
      teamAbbr === "SEATTLE" ||
      teamAbbr.includes("SEA");
    return {
      result: isHome ? "seahawks_first" : "patriots_first",
      reason: `First score by ${first.team}: ${first.description.slice(0, 60)}`,
    };
  },

  // 5: Team leads by 14+ and loses (Falconing)
  5: (_prop, gameData) => {
    if (gameData.status !== "final") return null;
    const happened = checkComebackFrom14(gameData);
    return {
      result: happened ? "yes" : "no",
      reason: happened
        ? "A team led by 14+ and lost"
        : "No team led by 14+ and lost",
    };
  },

  // 6: QB passing yards comparison
  6: (_prop, gameData) => {
    if (gameData.status !== "final") return null;
    const maye = findPlayerStat(gameData, "maye");
    const darnold = findPlayerStat(gameData, "darnold");
    if (!maye || !darnold) return null;
    const mayeYds = maye.stats.passYds;
    const darnoldYds = darnold.stats.passYds;
    if (mayeYds === darnoldYds) return null; // Push on tie
    return {
      result: mayeYds > darnoldYds ? "maye" : "darnold",
      reason: `Maye: ${mayeYds} yds, Darnold: ${darnoldYds} yds`,
    };
  },

  // 7: RB rushing yards comparison
  7: (_prop, gameData) => {
    if (gameData.status !== "final") return null;
    const walker = findPlayerStat(gameData, "walker");
    const stevenson = findPlayerStat(gameData, "stevenson");
    if (!walker || !stevenson) return null;
    const walkerYds = walker.stats.rushYds;
    const stevensonYds = stevenson.stats.rushYds;
    if (walkerYds === stevensonYds) return null; // Push on tie
    return {
      result: walkerYds > stevensonYds ? "walker" : "stevenson",
      reason: `Walker: ${walkerYds} yds, Stevenson: ${stevensonYds} yds`,
    };
  },

  // 8: Leading receiver
  8: (prop, gameData) => {
    if (gameData.status !== "final") return null;
    // Find player with most receiving yards
    let maxYds = -1;
    let maxName = "";
    let maxId = "";
    for (const [id, stats] of Object.entries(gameData.playerStats)) {
      if (stats.recYds > maxYds) {
        maxYds = stats.recYds;
        maxName = stats.name;
        maxId = id;
      }
    }
    if (maxYds < 0 || !maxId) return null;

    // Check which option matches
    const namedOptions = ["jsn", "diggs", "kupp", "henry"];
    for (const optVal of namedOptions) {
      const match = findPlayerStat(gameData, optVal);
      if (match && match.name === maxName) {
        return {
          result: optVal,
          reason: `Leading receiver: ${maxName} with ${maxYds} yds`,
        };
      }
    }

    // Check if any named option ties with the leader
    for (const optVal of namedOptions) {
      const match = findPlayerStat(gameData, optVal);
      if (match && match.stats.recYds === maxYds) {
        return {
          result: optVal,
          reason: `Tied for lead: ${match.name} with ${maxYds} yds (named option wins tie)`,
        };
      }
    }

    // Must be "other"
    if (prop.options.some((o) => o.value === "other")) {
      return {
        result: "other",
        reason: `Leading receiver: ${maxName} (${maxYds} yds) — not a named option`,
      };
    }
    return null;
  },

  // 9: First TD scorer
  9: (prop, gameData) => {
    const firstTD = getFirstTDPlay(gameData);
    if (!firstTD) {
      // If game is final and no TDs, it's a push (no TD in game)
      if (gameData.status === "final") return null;
      return null;
    }

    // Check named players
    const tdOptions = [
      "walker_td",
      "stevenson_td",
      "jsn_td",
      "maye_td",
      "darnold_td",
      "diggs_td",
      "kupp_td",
    ];
    for (const optVal of tdOptions) {
      if (scoringPlayMatchesPlayer(firstTD, optVal)) {
        return {
          result: optVal,
          reason: `First TD: ${firstTD.description.slice(0, 80)}`,
        };
      }
    }

    // Must be "field" (other/DEF/ST)
    if (prop.options.some((o) => o.value === "field")) {
      return {
        result: "field",
        reason: `First TD (unlisted player): ${firstTD.description.slice(0, 80)}`,
      };
    }
    return null;
  },

  // 10: MVP — CANNOT auto-resolve (no ESPN data)

  // 11: Combined sacks O/U
  11: (prop, gameData) => {
    if (gameData.status !== "final") return null;
    if (prop.threshold === null) return null;
    const totalSacks = getTotalSacks(gameData);
    return {
      result: totalSacks > prop.threshold ? "over" : "under",
      reason: `Total sacks: ${totalSacks} vs line ${prop.threshold}`,
    };
  },

  // 12: Combined TDs O/U
  12: (prop, gameData) => {
    if (gameData.status !== "final") return null;
    if (prop.threshold === null) return null;
    const totalTDs = getTotalTDs(gameData);
    return {
      result: totalTDs > prop.threshold ? "over" : "under",
      reason: `Total TDs: ${totalTDs} vs line ${prop.threshold}`,
    };
  },

  // 13: Coin toss — CANNOT auto-resolve
  // 14: National anthem — CANNOT auto-resolve
  // 15: Gatorade color — CANNOT auto-resolve

  // 16: First score type
  16: (_prop, gameData) => {
    const first = getFirstScoringPlay(gameData);
    if (!first) return null;

    if (first.type === "FG") {
      return { result: "field_goal", reason: `First score: FG — ${first.description.slice(0, 60)}` };
    }
    if (first.type === "Safety") {
      return { result: "safety_other", reason: `First score: Safety — ${first.description.slice(0, 60)}` };
    }
    if (first.type === "TD") {
      const desc = first.description.toLowerCase();
      // Passing TD: description typically contains "pass" or "Yd Pass"
      if (desc.includes("pass") || desc.includes("pass to")) {
        return { result: "passing_td", reason: `First score: Passing TD — ${first.description.slice(0, 60)}` };
      }
      // Rushing TD: description typically contains "run" or "Yd Run"
      if (desc.includes("run") || desc.includes("rush")) {
        return { result: "rushing_td", reason: `First score: Rushing TD — ${first.description.slice(0, 60)}` };
      }
      // Defensive/ST TD or unclear
      return { result: "safety_other", reason: `First score: TD (non-pass/rush) — ${first.description.slice(0, 60)}` };
    }

    return null;
  },

  // 17: Will there be an INT
  17: (_prop, gameData) => {
    const totalINTs = getTotalINTs(gameData);
    if (totalINTs > 0) {
      // Can resolve "yes" during game
      return { result: "yes", reason: `${totalINTs} INT(s) so far` };
    }
    // Can only resolve "no" at final
    if (gameData.status === "final") {
      return { result: "no", reason: "No interceptions in the game" };
    }
    return null;
  },

  // 18: Highest-scoring quarter
  18: (_prop, gameData) => {
    if (gameData.status !== "final") return null;
    const qPoints = getPointsByQuarter(gameData);
    let maxQ = 1;
    let maxPts = qPoints[1];
    for (let q = 2; q <= 4; q++) {
      if (qPoints[q] > maxPts) {
        maxPts = qPoints[q];
        maxQ = q;
      }
    }
    return {
      result: `q${maxQ}`,
      reason: `Q1:${qPoints[1]} Q2:${qPoints[2]} Q3:${qPoints[3]} Q4:${qPoints[4]} — Q${maxQ} wins with ${maxPts}`,
    };
  },

  // 19: FG hits upright — CANNOT auto-resolve

  // 20: Overtime
  20: (_prop, gameData) => {
    // Can resolve "yes" if quarter > 4
    if (gameData.quarter > 4) {
      return { result: "yes", reason: `Game in OT (Q${gameData.quarter})` };
    }
    // Can only resolve "no" at final
    if (gameData.status === "final" && gameData.quarter <= 4) {
      return { result: "no", reason: "Game ended in regulation" };
    }
    return null;
  },

  // 21: Safety
  21: (_prop, gameData) => {
    if (hasSafety(gameData)) {
      return { result: "yes", reason: "Safety occurred in the game" };
    }
    if (gameData.status === "final") {
      return { result: "no", reason: "No safety in the game" };
    }
    return null;
  },
};

// ── Exported functions ────────────────────────────────────────────────

/**
 * Get current stat value for in-progress live tracking.
 * Powers the Trending/Trailing indicators in the UI.
 */
export function getCurrentStatValue(
  prop: Prop,
  gameData: ESPNGameData
): number | null {
  // Game-level stats by stat_key
  if (prop.stat_key === "total_points") {
    return gameData.homeScore + gameData.awayScore;
  }
  if (prop.stat_key === "total_sacks") {
    return getTotalSacks(gameData);
  }
  if (prop.stat_key === "total_tds") {
    return getTotalTDs(gameData);
  }

  // Player-level stats by stat_key
  if (prop.stat_key && prop.player_name) {
    for (const [, stats] of Object.entries(gameData.playerStats)) {
      const name = stats.name.toLowerCase();
      if (name.includes(prop.player_name.toLowerCase())) {
        const statKey = prop.stat_key as keyof typeof stats;
        const value = Number(stats[statKey]);
        return isNaN(value) ? null : value;
      }
    }
  }

  return null;
}

/**
 * Resolve all auto-resolvable props from ESPN data.
 * Called by poll-game endpoint.
 */
export function resolveProps(
  props: Prop[],
  gameData: ESPNGameData
): ResolvedProp[] {
  const resolved: ResolvedProp[] = [];

  for (const prop of props) {
    if (prop.status === "resolved") continue;
    if (!prop.auto_resolve) continue;

    const resolver = RESOLVERS[prop.sort_order];
    if (!resolver) continue;

    const result = resolver(prop, gameData);
    if (result) {
      resolved.push({
        propId: prop.id,
        result: result.result,
        reason: result.reason,
      });
    }
  }

  return resolved;
}

/**
 * Convenience: list which props need manual resolution.
 * Returns sort_order and question for unresolved non-auto props.
 */
export function getManualProps(props: Prop[]): { sort_order: number; id: string; question: string; options: string[] }[] {
  return props
    .filter((p) => p.status !== "resolved" && !p.auto_resolve)
    .map((p) => ({
      sort_order: p.sort_order,
      id: p.id,
      question: p.question,
      options: p.options.map((o) => `${o.value} (${o.label})`),
    }));
}
