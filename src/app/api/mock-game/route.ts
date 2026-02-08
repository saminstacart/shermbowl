import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { oddsToPoints } from "@/lib/types";
import type { Prop, Pick } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Mock game simulation API.
 * Accepts a `step` parameter (1-14) to advance through a simulated Super Bowl.
 * Each step writes directly to Supabase (no ESPN dependency).
 *
 * POST /api/mock-game { key, step }
 */

// Simulated game timeline
const STEPS: Record<
  number,
  {
    label: string;
    gameState: {
      home_score: number;
      away_score: number;
      quarter: number;
      clock: string;
      status: "pre" | "in_progress" | "halftime" | "final";
      last_play: string | null;
    };
    // Props to update: { propName: { status, current_value, live_stats, result } }
    propUpdates: Record<
      string,
      {
        status?: "pending" | "in_progress" | "resolved";
        current_value?: number;
        live_stats?: Record<string, unknown>;
        result?: string;
      }
    >;
  }
> = {
  // Step 1: Pre-game
  1: {
    label: "Pre-game — set game state to pre",
    gameState: {
      home_score: 0,
      away_score: 0,
      quarter: 0,
      clock: "0:00",
      status: "pre",
      last_play: null,
    },
    propUpdates: {},
  },

  // Step 2: Kickoff — game starts
  2: {
    label: "Kickoff — game starts, all trackable props move to in_progress",
    gameState: {
      home_score: 0,
      away_score: 0,
      quarter: 1,
      clock: "15:00",
      status: "in_progress",
      last_play: "Kickoff: NE kicks off to SEA",
    },
    propUpdates: {},
  },

  // Step 3: Resolve coin toss (Heads) and anthem (Over 2:00)
  3: {
    label: "Resolve Coin Toss (Heads) and Anthem (Over 2:00)",
    gameState: {
      home_score: 0,
      away_score: 0,
      quarter: 1,
      clock: "14:45",
      status: "in_progress",
      last_play: "SEA ball at SEA 25",
    },
    propUpdates: {
      "Coin Flip Degen": { status: "resolved", result: "heads" },
      "Anthem Length": { status: "resolved", result: "over" },
    },
  },

  // Step 4: First score — NE FG. NE 3 - SEA 0
  4: {
    label: "Q1: NE Field Goal — NE 3, SEA 0",
    gameState: {
      home_score: 0,
      away_score: 3,
      quarter: 1,
      clock: "7:22",
      status: "in_progress",
      last_play: "NE FG 42 yards by Folk",
    },
    propUpdates: {
      "First to Score": { status: "resolved", result: "patriots_first" },
      "First Score Type": { status: "resolved", result: "field_goal" },
      "Total Points": {
        status: "in_progress",
        current_value: 3,
      },
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 45, darnold: 28 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 12, stevenson: 18 },
      },
      "Total Sacks": {
        status: "in_progress",
        current_value: 1,
      },
    },
  },

  // Step 5: Q1 stats update — more player stats
  5: {
    label: "Q1: Player stat updates",
    gameState: {
      home_score: 0,
      away_score: 3,
      quarter: 1,
      clock: "2:15",
      status: "in_progress",
      last_play: "Walker rush for 8 yards",
    },
    propUpdates: {
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 78, darnold: 52 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 31, stevenson: 22 },
      },
      "Leading Receiver": {
        status: "in_progress",
        live_stats: { jsn: 34, diggs: 18, kupp: 12, henry: 8, other: 22 },
      },
      "Total Sacks": {
        status: "in_progress",
        current_value: 2,
      },
    },
  },

  // Step 6: Q2 — SEA TD pass to JSN. NE 3 - SEA 7
  6: {
    label: "Q2: SEA passing TD to JSN — NE 3, SEA 7",
    gameState: {
      home_score: 7,
      away_score: 3,
      quarter: 2,
      clock: "11:30",
      status: "in_progress",
      last_play: "Darnold pass to Jaxon Smith-Njigba for 22-yd TD",
    },
    propUpdates: {
      "First TD Scorer": { status: "resolved", result: "jsn_td" },
      "Total Points": {
        status: "in_progress",
        current_value: 10,
      },
      "Total TDs": {
        status: "in_progress",
        current_value: 1,
      },
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 112, darnold: 98 },
      },
      "Leading Receiver": {
        status: "in_progress",
        live_stats: { jsn: 67, diggs: 31, kupp: 28, henry: 15, other: 38 },
      },
    },
  },

  // Step 7: Q2 — NE TD rush by Stevenson. NE 10 - SEA 7
  7: {
    label: "Q2: NE rushing TD by Stevenson — NE 10, SEA 7",
    gameState: {
      home_score: 7,
      away_score: 10,
      quarter: 2,
      clock: "4:18",
      status: "in_progress",
      last_play: "Stevenson rush for 3-yd TD",
    },
    propUpdates: {
      "Total Points": {
        status: "in_progress",
        current_value: 17,
      },
      "Total TDs": {
        status: "in_progress",
        current_value: 2,
      },
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 148, darnold: 121 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 42, stevenson: 51 },
      },
      "Leading Receiver": {
        status: "in_progress",
        live_stats: { jsn: 72, diggs: 48, kupp: 35, henry: 22, other: 44 },
      },
      "Any Interceptions?": {
        status: "in_progress",
        live_stats: { yes: 0, no: 1 },
      },
      "Total Sacks": {
        status: "in_progress",
        current_value: 3,
      },
    },
  },

  // Step 8: Halftime — NE 10 - SEA 7
  8: {
    label: "Halftime — NE 10, SEA 7",
    gameState: {
      home_score: 7,
      away_score: 10,
      quarter: 2,
      clock: "0:00",
      status: "halftime",
      last_play: "End of first half",
    },
    propUpdates: {
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 162, darnold: 134 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 48, stevenson: 55 },
      },
    },
  },

  // Step 9: Q3 — SEA FG. NE 10 - SEA 10
  9: {
    label: "Q3: SEA Field Goal — NE 10, SEA 10",
    gameState: {
      home_score: 10,
      away_score: 10,
      quarter: 3,
      clock: "8:42",
      status: "in_progress",
      last_play: "SEA FG 38 yards by Myers",
    },
    propUpdates: {
      "Total Points": {
        status: "in_progress",
        current_value: 20,
      },
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 198, darnold: 172 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 62, stevenson: 58 },
      },
      "Leading Receiver": {
        status: "in_progress",
        live_stats: { jsn: 87, diggs: 64, kupp: 52, henry: 31, other: 58 },
      },
      "Total Sacks": {
        status: "in_progress",
        current_value: 4,
      },
    },
  },

  // Step 10: Q4 — NE passing TD to Diggs. NE 17 - SEA 10. INT by NE defense.
  10: {
    label: "Q4: NE passing TD to Diggs + INT — NE 17, SEA 10",
    gameState: {
      home_score: 10,
      away_score: 17,
      quarter: 4,
      clock: "9:15",
      status: "in_progress",
      last_play: "Maye pass to Diggs for 34-yd TD. Darnold intercepted on next drive.",
    },
    propUpdates: {
      "Total Points": {
        status: "in_progress",
        current_value: 27,
      },
      "Total TDs": {
        status: "in_progress",
        current_value: 3,
      },
      "Any Interceptions?": {
        status: "in_progress",
        live_stats: { yes: 1, no: 0 },
      },
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 267, darnold: 198 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 71, stevenson: 68 },
      },
      "Leading Receiver": {
        status: "in_progress",
        live_stats: { jsn: 92, diggs: 98, kupp: 61, henry: 38, other: 65 },
      },
      "Total Sacks": {
        status: "in_progress",
        current_value: 5,
      },
    },
  },

  // Step 11: Q4 — SEA TD. NE 17 - SEA 17. Then NE FG. NE 20 - SEA 17.
  11: {
    label: "Q4: SEA ties it, NE FG — NE 20, SEA 17",
    gameState: {
      home_score: 17,
      away_score: 20,
      quarter: 4,
      clock: "1:42",
      status: "in_progress",
      last_play: "Folk FG 31 yards. NE leads 20-17.",
    },
    propUpdates: {
      "Total Points": {
        status: "in_progress",
        current_value: 37,
      },
      "Total TDs": {
        status: "in_progress",
        current_value: 4,
      },
      "Passing Yards": {
        status: "in_progress",
        live_stats: { maye: 289, darnold: 245 },
      },
      "Rushing Yards": {
        status: "in_progress",
        live_stats: { walker: 82, stevenson: 74 },
      },
      "Leading Receiver": {
        status: "in_progress",
        live_stats: { jsn: 105, diggs: 102, kupp: 68, henry: 42, other: 72 },
      },
      "Total Sacks": {
        status: "in_progress",
        current_value: 6,
      },
    },
  },

  // Step 12: Game final — NE 20, SEA 17. Resolve game-level props.
  12: {
    label: "Game Final — NE 20, SEA 17. Resolve game props.",
    gameState: {
      home_score: 17,
      away_score: 20,
      quarter: 4,
      clock: "0:00",
      status: "final",
      last_play: "Final: New England Patriots 20, Seattle Seahawks 17",
    },
    propUpdates: {
      "Game Winner": { status: "resolved", result: "patriots" },
      "Total Points": { status: "resolved", result: "under", current_value: 37 },
      "Margin of Victory": { status: "resolved", result: "1_6" },
      "Falconing Alert": { status: "resolved", result: "no" },
      "Overtime": { status: "resolved", result: "no" },
      "Safety Dance": { status: "resolved", result: "no" },
      "Any Interceptions?": { status: "resolved", result: "yes" },
      "Total Sacks": { status: "resolved", result: "over", current_value: 6 },
      "Total TDs": { status: "resolved", result: "under", current_value: 4 },
      "Highest-Scoring Quarter": { status: "resolved", result: "q4" },
      "The Doink": { status: "resolved", result: "no" },
    },
  },

  // Step 13: Resolve player props (final stats)
  13: {
    label: "Resolve player props — final stat lines",
    gameState: {
      home_score: 17,
      away_score: 20,
      quarter: 4,
      clock: "0:00",
      status: "final",
      last_play: "Final: New England Patriots 20, Seattle Seahawks 17",
    },
    propUpdates: {
      "Passing Yards": {
        status: "resolved",
        result: "maye",
        live_stats: { maye: 289, darnold: 245 },
      },
      "Rushing Yards": {
        status: "resolved",
        result: "walker",
        live_stats: { walker: 82, stevenson: 74 },
      },
      "Leading Receiver": {
        status: "resolved",
        result: "jsn",
        live_stats: { jsn: 105, diggs: 102, kupp: 68, henry: 42, other: 72 },
      },
      "Super Bowl MVP": { status: "resolved", result: "maye_mvp" },
    },
  },

  // Step 14: Resolve broadcast-only props (Gatorade, etc.)
  14: {
    label: "Resolve Gatorade Bath (Orange) — all props resolved",
    gameState: {
      home_score: 17,
      away_score: 20,
      quarter: 4,
      clock: "0:00",
      status: "final",
      last_play: "Final: New England Patriots 20, Seattle Seahawks 17",
    },
    propUpdates: {
      "Gatorade Bath": { status: "resolved", result: "orange" },
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const { key, step } = await req.json().catch(() => ({ key: "", step: 0 }));
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stepNum = Number(step);
    if (!STEPS[stepNum]) {
      return NextResponse.json(
        {
          error: `Invalid step: ${step}. Valid steps: 1-${Object.keys(STEPS).length}`,
          steps: Object.entries(STEPS).map(([k, v]) => ({ step: k, label: v.label })),
        },
        { status: 400 }
      );
    }

    const stepData = STEPS[stepNum];
    const supabase = createAdminClient();

    // 1. Update game state
    const { error: gameStateError } = await supabase
      .from("game_state")
      .update({
        ...stepData.gameState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (gameStateError) {
      console.error("[POST /api/mock-game] game_state update failed:", gameStateError.message);
      return NextResponse.json({ error: "Failed to update game state" }, { status: 500 });
    }

    // 2. If step 2 (kickoff), move all pending props to in_progress
    if (stepNum === 2) {
      const { error: kickoffError } = await supabase
        .from("props")
        .update({ status: "in_progress" })
        .eq("status", "pending");

      if (kickoffError) {
        console.error("[POST /api/mock-game] kickoff status update failed:", kickoffError.message);
      }
    }

    // 3. Apply prop-specific updates
    // Look up props by question since the `name` column may not exist in the DB
    const propUpdates: string[] = [];
    const nameToQuestion: Record<string, string> = {
      "Game Winner": "Who wins Super Bowl LX?",
      "Total Points": "Combined points O/U 45.5",
      "Margin of Victory": "Winning team's margin of victory",
      "First to Score": "Which team scores first?",
      "Falconing Alert": "Will a team lead by 14+ points and then lose?",
      "Passing Yards": "Which QB has more passing yards?",
      "Rushing Yards": "Which RB has more rushing yards?",
      "Leading Receiver": "Who leads the game in receiving yards?",
      "First TD Scorer": "Who scores the first touchdown?",
      "Super Bowl MVP": "Who wins Super Bowl MVP?",
      "Total Sacks": "Combined sacks O/U 4.5",
      "Total TDs": "Combined touchdowns O/U 4.5",
      "Coin Flip Degen": "What is the result of the opening coin toss?",
      "Anthem Length": "National Anthem O/U 2:00 (minutes)",
      "Gatorade Bath": "What color liquid is poured on the winning coach?",
      "First Score Type": "What type of play is the first score?",
      "Any Interceptions?": "Will there be an interception in the game?",
      "Highest-Scoring Quarter": "Which quarter has the most combined points?",
      "The Doink": "Will a FG attempt hit the upright or crossbar?",
      "Overtime": "Will the game go to overtime?",
      "Safety Dance": "Will there be a safety?",
    };

    for (const [propName, updates] of Object.entries(stepData.propUpdates)) {
      try {
        const question = nameToQuestion[propName] || propName;
        // Try by name first, fall back to question
        let prop: { id: string } | null = null;
        const { data: byName } = await supabase
          .from("props")
          .select("id")
          .eq("name", propName)
          .maybeSingle();
        prop = byName;
        if (!prop) {
          const { data: byQuestion } = await supabase
            .from("props")
            .select("id")
            .eq("question", question)
            .maybeSingle();
          prop = byQuestion;
        }

        if (!prop) {
          propUpdates.push(`SKIP: ${propName} (not found)`);
          continue;
        }

        const updateFields: Record<string, unknown> = {};
        if (updates.status) updateFields.status = updates.status;
        if (updates.current_value !== undefined) updateFields.current_value = updates.current_value;
        if (updates.live_stats) updateFields.live_stats = updates.live_stats;
        if (updates.result) updateFields.result = updates.result;

        const { error: propUpdateError } = await supabase.from("props").update(updateFields).eq("id", prop.id);
        if (propUpdateError) {
          propUpdates.push(`ERROR: ${propName} (${propUpdateError.message})`);
        } else {
          propUpdates.push(`${propName}: ${JSON.stringify(updates)}`);
        }
      } catch (propErr) {
        propUpdates.push(`ERROR: ${propName} (${propErr instanceof Error ? propErr.message : "unknown"})`);
      }
    }

    // 4. If any props were resolved, recalculate scores
    const hasResolutions = Object.values(stepData.propUpdates).some(
      (u) => u.status === "resolved" && u.result
    );
    if (hasResolutions) {
      try {
        await recalculateAllScores(supabase);
      } catch (scoreErr) {
        console.error("[POST /api/mock-game] Score recalculation failed:", scoreErr);
      }
    }

    return NextResponse.json({
      step: stepNum,
      label: stepData.label,
      gameState: stepData.gameState,
      propUpdates,
      totalSteps: Object.keys(STEPS).length,
    });
  } catch (err) {
    console.error("[POST /api/mock-game] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: List all steps
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      steps: Object.entries(STEPS).map(([k, v]) => ({
        step: Number(k),
        label: v.label,
        gameState: v.gameState,
        propUpdatesCount: Object.keys(v.propUpdates).length,
      })),
    });
  } catch (err) {
    console.error("[GET /api/mock-game] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function recalculateAllScores(
  supabase: ReturnType<typeof createAdminClient>
) {
  const { data: players } = await supabase.from("players").select("id, name");
  const { data: allPicks } = await supabase
    .from("picks")
    .select("*") as { data: Pick[] | null };
  const { data: props } = await supabase
    .from("props")
    .select("*") as { data: Prop[] | null };

  if (!players || !allPicks || !props) return;

  const propMap = new Map(props.map((p) => [p.id, p]));

  for (const player of players) {
    const playerPicks = allPicks.filter((p) => p.player_id === player.id);
    let total = 0;
    let maxPossible = 0;

    for (const pick of playerPicks) {
      const prop = propMap.get(pick.prop_id);
      if (!prop) continue;

      const option = prop.options.find((o) => o.value === pick.selection);
      if (!option) continue;

      const pointValue = oddsToPoints(option.odds);

      if (prop.status === "resolved") {
        const isCorrect = prop.result === pick.selection;
        if (isCorrect) {
          total += pointValue;
          maxPossible += pointValue;
        }
        await supabase
          .from("picks")
          .update({
            points_earned: isCorrect ? pointValue : 0,
            is_correct: isCorrect,
          })
          .eq("id", pick.id);
      } else {
        maxPossible += pointValue;
      }
    }

    await supabase
      .from("players")
      .update({
        total_points: total,
        max_possible: maxPossible,
      })
      .eq("id", player.id);
  }

  // Update ranks
  const { data: ranked } = await supabase
    .from("players")
    .select("id, total_points, max_possible")
    .order("total_points", { ascending: false })
    .order("max_possible", { ascending: false });

  if (ranked) {
    for (let i = 0; i < ranked.length; i++) {
      await supabase
        .from("players")
        .update({ rank: i + 1 })
        .eq("id", ranked[i].id);
    }
  }
}
