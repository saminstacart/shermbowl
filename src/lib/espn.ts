const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

export interface ESPNGameData {
  homeScore: number;
  awayScore: number;
  quarter: number;
  clock: string;
  status: "pre" | "in_progress" | "halftime" | "final";
  lastPlay: string | null;
  playerStats: Record<string, PlayerStatLine>;
  scoringPlays: ScoringPlay[];
  teamStats: {
    home: TeamStats;
    away: TeamStats;
  };
}

export interface PlayerStatLine {
  name: string;
  team: string;
  passYds: number;
  passTds: number;
  passAttempts: number;
  passCompletions: number;
  interceptions: number;
  rushYds: number;
  rushTds: number;
  rushAttempts: number;
  recYds: number;
  recTds: number;
  receptions: number;
  sacks: number;
  fieldGoals: number;
}

export interface ScoringPlay {
  quarter: number;
  clock: string;
  team: string;
  type: string; // "TD", "FG", "Safety", "PAT", "2PT"
  description: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamStats {
  totalYards: number;
  turnovers: number;
  firstDowns: number;
  penalties: number;
  penaltyYards: number;
  sacks: number;
}

function parseStatus(
  espnStatus: string,
  period: number
): "pre" | "in_progress" | "halftime" | "final" {
  const s = espnStatus?.toLowerCase() || "";
  if (s.includes("final") || s.includes("end")) return "final";
  if (s.includes("halftime")) return "halftime";
  if (s.includes("in") || s.includes("progress") || period > 0) return "in_progress";
  return "pre";
}

function safeNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parsePlayerStats(boxScore: any): Record<string, PlayerStatLine> {
  const stats: Record<string, PlayerStatLine> = {};

  if (!boxScore?.players) return stats;

  for (const teamData of boxScore.players) {
    const teamAbbr = teamData.team?.abbreviation || "";
    const categories = teamData.statistics || [];

    for (const cat of categories) {
      const catName = cat.name?.toLowerCase() || "";
      const athletes = cat.athletes || [];

      for (const athlete of athletes) {
        const name = athlete.athlete?.displayName || "Unknown";
        const id = athlete.athlete?.id || name;
        if (!stats[id]) {
          stats[id] = {
            name,
            team: teamAbbr,
            passYds: 0, passTds: 0, passAttempts: 0, passCompletions: 0,
            interceptions: 0, rushYds: 0, rushTds: 0, rushAttempts: 0,
            recYds: 0, recTds: 0, receptions: 0, sacks: 0, fieldGoals: 0,
          };
        }

        const statLine = (athlete.stats || []) as string[];

        if (catName === "passing" && statLine.length >= 6) {
          // C/ATT, YDS, AVG, TD, INT, QBR (varies)
          const compAtt = (statLine[0] || "0/0").split("/");
          stats[id].passCompletions = safeNum(compAtt[0]);
          stats[id].passAttempts = safeNum(compAtt[1]);
          stats[id].passYds = safeNum(statLine[1]);
          stats[id].passTds = safeNum(statLine[3]);
          stats[id].interceptions = safeNum(statLine[4]);
        }
        if (catName === "rushing" && statLine.length >= 4) {
          // ATT, YDS, AVG, TD, LONG
          stats[id].rushAttempts = safeNum(statLine[0]);
          stats[id].rushYds = safeNum(statLine[1]);
          stats[id].rushTds = safeNum(statLine[3]);
        }
        if (catName === "receiving" && statLine.length >= 4) {
          // REC, YDS, AVG, TD, LONG, TGTS
          stats[id].receptions = safeNum(statLine[0]);
          stats[id].recYds = safeNum(statLine[1]);
          stats[id].recTds = safeNum(statLine[3]);
        }
        if (catName === "defensive" && statLine.length >= 3) {
          stats[id].sacks = safeNum(statLine[2]);
        }
        if (catName === "kicking" && statLine.length >= 1) {
          // FG, PCT, LONG, XP
          const fgParts = (statLine[0] || "0/0").split("/");
          stats[id].fieldGoals = safeNum(fgParts[0]);
        }
      }
    }
  }

  return stats;
}

function parseScoringPlays(drives: any): ScoringPlay[] {
  const plays: ScoringPlay[] = [];
  if (!drives?.previous) return plays;

  for (const drive of drives.previous) {
    if (!drive.result?.name) continue;
    const result = drive.result.name.toUpperCase();
    if (
      result.includes("TOUCHDOWN") ||
      result.includes("FIELD GOAL") ||
      result.includes("SAFETY")
    ) {
      let type = "TD";
      if (result.includes("FIELD GOAL")) type = "FG";
      if (result.includes("SAFETY")) type = "Safety";

      const lastPlay = drive.plays?.[drive.plays.length - 1];
      plays.push({
        quarter: lastPlay?.period?.number || 0,
        clock: lastPlay?.clock?.displayValue || "",
        team: drive.team?.abbreviation || "",
        type,
        description: drive.description || lastPlay?.text || "",
        homeScore: lastPlay?.homeScore || 0,
        awayScore: lastPlay?.awayScore || 0,
      });
    }
  }

  return plays;
}

function parseTeamStats(boxScore: any): { home: TeamStats; away: TeamStats } {
  const empty: TeamStats = {
    totalYards: 0, turnovers: 0, firstDowns: 0,
    penalties: 0, penaltyYards: 0, sacks: 0,
  };

  if (!boxScore?.teams) return { home: { ...empty }, away: { ...empty } };

  const teams = boxScore.teams;
  const parse = (teamData: any): TeamStats => {
    const stats = teamData.statistics || [];
    const get = (name: string) =>
      safeNum(stats.find((s: any) => s.name === name)?.displayValue);
    return {
      totalYards: get("totalYards"),
      turnovers: get("turnovers"),
      firstDowns: get("firstDowns"),
      penalties: get("totalPenalties"),
      penaltyYards: get("totalPenaltiesYards"),
      sacks: get("sacksTotal"),
    };
  };

  return {
    away: teams[0] ? parse(teams[0]) : { ...empty },
    home: teams[1] ? parse(teams[1]) : { ...empty },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchGameData(eventId: string): Promise<ESPNGameData> {
  const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`, {
    next: { revalidate: 0 },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`ESPN API error: ${res.status}`);
  }

  const data = await res.json();
  const competition = data.header?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((c: { homeAway: string }) => c.homeAway === "home");
  const away = competitors.find((c: { homeAway: string }) => c.homeAway === "away");
  const statusDetail = competition?.status?.type?.name || "STATUS_SCHEDULED";
  const period = competition?.status?.period || 0;

  return {
    homeScore: safeNum(home?.score),
    awayScore: safeNum(away?.score),
    quarter: period,
    clock: competition?.status?.displayClock || "0:00",
    status: parseStatus(statusDetail, period),
    lastPlay: data.drives?.current?.plays?.slice(-1)[0]?.text || null,
    playerStats: parsePlayerStats(data.boxscore),
    scoringPlays: parseScoringPlays(data.drives),
    teamStats: parseTeamStats(data.boxscore),
  };
}
