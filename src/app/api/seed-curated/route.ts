import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CURATED_PROPS = [
  // ===== GAME (5) =====
  {
    name: "Game Winner",
    category: "game",
    question: "Who wins Super Bowl LX?",
    prop_type: "binary",
    options: [
      { label: "Patriots", odds: 195, value: "patriots" },
      { label: "Seahawks", odds: -238, value: "seahawks" },
    ],
    sort_order: 1,
    auto_resolve: true,
    resolution_criteria:
      "Official NFL final score (including OT). No push possible — Super Bowl must have a winner.",
  },
  {
    name: "Total Points",
    category: "game",
    question: "Combined points O/U 45.5",
    prop_type: "over_under",
    options: [
      { label: "Over 45.5", odds: -108, value: "over" },
      { label: "Under 45.5", odds: -112, value: "under" },
    ],
    sort_order: 2,
    threshold: 45.5,
    auto_resolve: true,
    stat_key: "total_points",
    resolution_criteria:
      "Combined final score of both teams (official NFL box score, including OT). Over = 46+, Under = 45 or fewer. Half-point line eliminates ties.",
  },
  {
    name: "Margin of Victory",
    category: "game",
    question: "Winning team's margin of victory",
    prop_type: "multi_choice",
    options: [
      { label: "1-6 pts", odds: 200, value: "1_6" },
      { label: "7-12 pts", odds: 250, value: "7_12" },
      { label: "13-18 pts", odds: 350, value: "13_18" },
      { label: "19+ pts", odds: 400, value: "19_plus" },
    ],
    sort_order: 3,
    auto_resolve: true,
    resolution_criteria:
      "Final score difference (winner's score minus loser's score) from official NFL box score. Ranges are inclusive. OT counts.",
  },
  {
    name: "First to Score",
    category: "game",
    question: "Which team scores first?",
    prop_type: "binary",
    options: [
      { label: "Patriots", odds: -105, value: "patriots_first" },
      { label: "Seahawks", odds: -115, value: "seahawks_first" },
    ],
    sort_order: 4,
    auto_resolve: true,
    resolution_criteria:
      "First team credited with points on the official NFL play-by-play. Any scoring play counts (TD, FG, safety). If the game ends 0-0 at any point in regulation: push.",
  },
  {
    name: "Falconing Alert",
    category: "game",
    question: "Will a team lead by 14+ points and then lose?",
    prop_type: "binary",
    options: [
      { label: "Yes", odds: 350, value: "yes" },
      { label: "No", odds: -500, value: "no" },
    ],
    sort_order: 5,
    auto_resolve: true,
    resolution_criteria:
      'Using official NFL play-by-play scoring, if any team holds a lead of 14 or more points at any moment after a scoring play, and that team goes on to lose the game (final result), this resolves YES. If no team ever leads by 14+ points, or the team that led by 14+ wins, this resolves NO. OT loss by the leading team counts as YES.',
  },

  // ===== PLAYER (7) =====
  {
    name: "Passing Yards",
    category: "player",
    question: "Which QB has more passing yards?",
    prop_type: "binary",
    options: [
      { label: "Drake Maye", odds: -130, value: "maye" },
      { label: "Sam Darnold", odds: 110, value: "darnold" },
    ],
    sort_order: 6,
    auto_resolve: true,
    resolution_criteria:
      "Official NFL box score passing yards for each QB. If either QB does not play at all, prop is void (push — all picks score 0). If exactly tied, push.",
  },
  {
    name: "Rushing Yards",
    category: "player",
    question: "Which RB has more rushing yards?",
    prop_type: "binary",
    options: [
      { label: "Kenneth Walker", odds: -160, value: "walker" },
      { label: "Rhamondre Stevenson", odds: 140, value: "stevenson" },
    ],
    sort_order: 7,
    auto_resolve: true,
    resolution_criteria:
      "Official NFL box score rushing yards for each RB. If either RB does not play at all, prop is void (push). If exactly tied, push.",
  },
  {
    name: "Leading Receiver",
    category: "player",
    question: "Who leads the game in receiving yards?",
    prop_type: "multi_choice",
    options: [
      { label: "Jaxon Smith-Njigba", odds: 200, value: "jsn" },
      { label: "Stefon Diggs", odds: 400, value: "diggs" },
      { label: "Cooper Kupp", odds: 500, value: "kupp" },
      { label: "Hunter Henry", odds: 700, value: "henry" },
      { label: "Other", odds: 300, value: "other" },
    ],
    sort_order: 8,
    auto_resolve: true,
    resolution_criteria:
      'Player with the most receiving yards in official NFL box score wins. "Other" = any player NOT listed in the named options. If two or more players tie for most receiving yards, and one of them is a named option, that named option wins. If multiple named options tie for most, push between those options only.',
  },
  {
    name: "First TD Scorer",
    category: "player",
    question: "Who scores the first touchdown?",
    prop_type: "multi_choice",
    options: [
      { label: "Kenneth Walker", odds: 350, value: "walker_td" },
      { label: "Rhamondre Stevenson", odds: 850, value: "stevenson_td" },
      { label: "Jaxon Smith-Njigba", odds: 550, value: "jsn_td" },
      { label: "Drake Maye", odds: 1500, value: "maye_td" },
      { label: "Sam Darnold", odds: 4000, value: "darnold_td" },
      { label: "Stefon Diggs", odds: 1300, value: "diggs_td" },
      { label: "Cooper Kupp", odds: 1200, value: "kupp_td" },
      { label: "Field (Other/DEF/ST)", odds: 300, value: "field" },
    ],
    sort_order: 9,
    auto_resolve: true,
    resolution_criteria:
      'The player credited with the first TD on the official NFL play-by-play. Rushing/receiving TD = the ball carrier. Passing TD = the receiver (NOT the passer, per sportsbook convention). Defensive/special teams TD or any unlisted player = "Field." If no TD is scored in the game, push.',
  },
  {
    name: "Super Bowl MVP",
    category: "player",
    question: "Who wins Super Bowl MVP?",
    prop_type: "multi_choice",
    options: [
      { label: "Drake Maye", odds: 150, value: "maye_mvp" },
      { label: "Sam Darnold", odds: 250, value: "darnold_mvp" },
      { label: "Kenneth Walker", odds: 500, value: "walker_mvp" },
      { label: "Rhamondre Stevenson", odds: 700, value: "stevenson_mvp" },
      { label: "Jaxon Smith-Njigba", odds: 900, value: "jsn_mvp" },
      { label: "Other", odds: 400, value: "other_mvp" },
    ],
    sort_order: 10,
    auto_resolve: false,
    resolution_criteria:
      'Official Pete Rozelle Trophy winner as announced by the NFL. "Other" = any player not listed. If co-MVPs are awarded and one is listed, the listed player wins. If co-MVPs and both listed, push between those options.',
  },
  {
    name: "Total Sacks",
    category: "player",
    question: "Combined sacks O/U 4.5",
    prop_type: "over_under",
    options: [
      { label: "Over 4.5", odds: -110, value: "over" },
      { label: "Under 4.5", odds: -110, value: "under" },
    ],
    sort_order: 11,
    threshold: 4.5,
    auto_resolve: true,
    stat_key: "total_sacks",
    resolution_criteria:
      "Combined total sacks by BOTH teams from official NFL box score. Over = 5+ sacks, Under = 4 or fewer. Half-point line eliminates ties.",
  },
  {
    name: "Total TDs",
    category: "player",
    question: "Combined touchdowns O/U 4.5",
    prop_type: "over_under",
    options: [
      { label: "Over 4.5", odds: -120, value: "over" },
      { label: "Under 4.5", odds: 100, value: "under" },
    ],
    sort_order: 12,
    threshold: 4.5,
    auto_resolve: true,
    stat_key: "total_tds",
    resolution_criteria:
      "Combined total touchdowns scored by BOTH teams from official NFL box score. Includes rushing, receiving, defensive, and special teams TDs. Over = 5+, Under = 4 or fewer. Half-point line eliminates ties.",
  },

  // ===== FUN (7) =====
  {
    name: "Coin Flip Degen",
    category: "fun",
    question: "What is the result of the opening coin toss?",
    prop_type: "binary",
    options: [
      { label: "Heads", odds: -105, value: "heads" },
      { label: "Tails", odds: -105, value: "tails" },
    ],
    sort_order: 13,
    auto_resolve: false,
    resolution_criteria:
      "Official opening coin toss result as shown on the NFL broadcast. Not the call — the actual result of the flip.",
  },
  {
    name: "Anthem Length",
    category: "fun",
    question: "National Anthem O/U 2:00 (minutes)",
    prop_type: "over_under",
    options: [
      { label: "Over 2:00", odds: -140, value: "over" },
      { label: "Under 2:00", odds: 120, value: "under" },
    ],
    sort_order: 14,
    threshold: 120,
    auto_resolve: false,
    resolution_criteria:
      "Timed from the singer's first sung note to their last sustained note, per the official broadcast. Over = 2:01 or longer, Under = 2:00 or shorter. Standard sportsbook anthem timing rules apply.",
  },
  {
    name: "Gatorade Bath",
    category: "fun",
    question: "What color liquid is poured on the winning coach?",
    prop_type: "multi_choice",
    options: [
      { label: "Orange", odds: 250, value: "orange" },
      { label: "Blue", odds: 350, value: "blue" },
      { label: "Yellow", odds: 400, value: "yellow" },
      { label: "Clear/Water", odds: 300, value: "clear" },
      { label: "Red/Pink", odds: 600, value: "red_pink" },
      { label: "None/Other", odds: 800, value: "none_other" },
    ],
    sort_order: 15,
    auto_resolve: false,
    resolution_criteria:
      'Based on the color visible on the TV broadcast when the liquid is poured. "None/Other" = no bath occurs, or a color not matching any listed option. If multiple baths in different colors, the FIRST bath determines the result. Commissioner makes final color call if ambiguous.',
  },
  {
    name: "First Score Type",
    category: "fun",
    question: "What type of play is the first score?",
    prop_type: "multi_choice",
    options: [
      { label: "Passing TD", odds: 130, value: "passing_td" },
      { label: "Rushing TD", odds: 300, value: "rushing_td" },
      { label: "Field Goal", odds: 150, value: "field_goal" },
      { label: "Safety/Other", odds: 2500, value: "safety_other" },
    ],
    sort_order: 16,
    auto_resolve: true,
    resolution_criteria:
      "The type of the first scoring play per official NFL play-by-play. Passing TD = any forward pass resulting in a TD. Rushing TD = any rushing play resulting in a TD. Field Goal = successful FG. Safety/Other = safety, defensive TD, special teams TD, or any other scoring method.",
  },
  {
    name: "Any Interceptions?",
    category: "fun",
    question: "Will there be an interception in the game?",
    prop_type: "binary",
    options: [
      { label: "Yes (1+ INT)", odds: 120, value: "yes" },
      { label: "No (0 INTs)", odds: -140, value: "no" },
    ],
    sort_order: 17,
    auto_resolve: true,
    resolution_criteria:
      "Were there ANY interceptions in the game per official NFL box score? Yes = 1 or more total interceptions by either team. No = zero interceptions.",
  },
  {
    name: "Highest-Scoring Quarter",
    category: "fun",
    question: "Which quarter has the most combined points?",
    prop_type: "multi_choice",
    options: [
      { label: "Q1", odds: 350, value: "q1" },
      { label: "Q2", odds: 150, value: "q2" },
      { label: "Q3", odds: 300, value: "q3" },
      { label: "Q4", odds: 200, value: "q4" },
    ],
    sort_order: 18,
    auto_resolve: true,
    resolution_criteria:
      "The quarter with the highest combined points (both teams) from official NFL play-by-play. OT points do NOT count — only Q1-Q4. If two or more quarters tie for most points, the EARLIEST quarter wins (e.g., Q1 and Q3 both have 14 → Q1 wins).",
  },
  {
    name: "The Doink",
    category: "fun",
    question: "Will a FG attempt hit the upright or crossbar?",
    prop_type: "binary",
    options: [
      { label: "Yes", odds: 250, value: "yes" },
      { label: "No", odds: -350, value: "no" },
    ],
    sort_order: 19,
    auto_resolve: false,
    resolution_criteria:
      "Any field goal attempt (successful OR missed) that visibly contacts the upright or crossbar as shown on the TV broadcast, including replays. Make or miss doesn't matter — contact is what counts. Commissioner reviews broadcast footage for final call.",
  },

  // ===== DEGEN (2) =====
  {
    name: "Overtime",
    category: "degen",
    question: "Will the game go to overtime?",
    prop_type: "binary",
    options: [
      { label: "Yes", odds: 800, value: "yes" },
      { label: "No", odds: -1500, value: "no" },
    ],
    sort_order: 20,
    auto_resolve: true,
    resolution_criteria:
      "Per official NFL rules, if the game is tied at the end of Q4 regulation, overtime is played. If OT occurs, resolves YES. If the game ends in regulation, resolves NO.",
  },
  {
    name: "Safety Dance",
    category: "degen",
    question: "Will there be a safety?",
    prop_type: "binary",
    options: [
      { label: "Yes", odds: 900, value: "yes" },
      { label: "No", odds: -1800, value: "no" },
    ],
    sort_order: 21,
    auto_resolve: true,
    resolution_criteria:
      "Per official NFL play-by-play, a safety is scored when the offense is tackled in their own end zone, commits a penalty in their own end zone, or the ball goes out of their own end zone. If any safety occurs in the game (by either team), resolves YES. If no safety, resolves NO.",
  },
];

async function detectColumns(supabase: ReturnType<typeof createAdminClient>) {
  const cols: Record<string, boolean> = {};
  for (const col of ["name", "resolution_criteria", "live_stats"]) {
    const { error } = await supabase.from("props").select(col).limit(1);
    cols[col] = !error;
  }
  return cols;
}

async function checkDegenCategory(supabase: ReturnType<typeof createAdminClient>) {
  // Try inserting a dummy prop with category 'degen' to test the constraint
  const { error } = await supabase.from("props").insert({
    category: "degen",
    question: "__test__",
    prop_type: "binary",
    options: [],
    sort_order: 9999,
    status: "pending",
  });

  if (error && error.message.includes("props_category_check")) {
    return false; // constraint blocks 'degen'
  }

  // Delete the test prop
  await supabase.from("props").delete().eq("question", "__test__");
  return true;
}

async function doSeed(supabase: ReturnType<typeof createAdminClient>) {
  // Detect which optional columns exist
  const cols = await detectColumns(supabase);
  const degenAllowed = await checkDegenCategory(supabase);

  // Delete all existing picks and props (clean slate)
  await supabase.from("picks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("props").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Reset player scores
  await supabase
    .from("players")
    .update({ total_points: 0, max_possible: 0, picks_count: 0, rank: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // Build insert objects based on available columns
  const propsToInsert = CURATED_PROPS.map((p) => {
    const category = p.category === "degen" && !degenAllowed ? "fun" : p.category;

    const row: Record<string, unknown> = {
      category,
      question: p.question,
      prop_type: p.prop_type,
      options: p.options,
      sort_order: p.sort_order,
      auto_resolve: p.auto_resolve,
      stat_key: (p as Record<string, unknown>).stat_key || null,
      threshold: (p as Record<string, unknown>).threshold || null,
      status: "pending",
      current_value: null,
      result: null,
    };

    // Only include optional columns if they exist in the schema
    if (cols.name) row.name = p.name;
    if (cols.resolution_criteria) row.resolution_criteria = p.resolution_criteria;

    return row;
  });

  const { data, error } = await supabase
    .from("props")
    .insert(propsToInsert)
    .select();

  const warnings: string[] = [];
  if (!cols.name) warnings.push("'name' column missing — props seeded without names");
  if (!cols.resolution_criteria) warnings.push("'resolution_criteria' column missing — props seeded without resolution criteria");
  if (!cols.live_stats) warnings.push("'live_stats' column missing — live tracking will be limited");
  if (!degenAllowed) warnings.push("'degen' category not in constraint — degen props inserted as 'fun'");

  return { data, error, warnings };
}

export async function POST(req: NextRequest) {
  const { key, force } = await req.json().catch(() => ({ key: "", force: false }));
  if (key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Safety: refuse to re-seed if picks exist (would destroy player data)
  const { count: picksCount } = await supabase
    .from("picks")
    .select("*", { count: "exact", head: true });

  if (picksCount && picksCount > 0 && !force) {
    return NextResponse.json(
      {
        error: `BLOCKED: ${picksCount} picks exist in the database. Re-seeding would delete all of them. Pass {"force": true} to override (DESTRUCTIVE).`,
        picks_count: picksCount,
      },
      { status: 409 }
    );
  }

  const { data, error, warnings } = await doSeed(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: Record<string, unknown> = { count: data?.length || 0, props: data };
  if (warnings.length > 0) {
    response.warnings = warnings;
    response.migration_sql =
      "Run this SQL in Supabase Dashboard > SQL Editor to enable all features:\n\n" +
      "ALTER TABLE props ADD COLUMN IF NOT EXISTS name text;\n" +
      "ALTER TABLE props ADD COLUMN IF NOT EXISTS resolution_criteria text;\n" +
      "ALTER TABLE props ADD COLUMN IF NOT EXISTS live_stats jsonb;\n" +
      "ALTER TABLE props DROP CONSTRAINT IF EXISTS props_category_check;\n" +
      "ALTER TABLE props ADD CONSTRAINT props_category_check CHECK (category IN ('game', 'player', 'fun', 'degen'));";
  }

  return NextResponse.json(response);
}

// GET: Auto-seed if props table is empty (for initial setup)
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if props already exist
  const { data: existing } = await supabase
    .from("props")
    .select("id")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: "Props already seeded", count: -1 });
  }

  const { data, error, warnings } = await doSeed(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data?.length || 0, seeded: true, warnings });
}
