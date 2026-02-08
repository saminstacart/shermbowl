import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { fetchGameData } from "@/lib/espn";
import { resolveProps, getCurrentStatValue } from "@/lib/resolver";

export const dynamic = "force-dynamic";
import { oddsToPoints } from "@/lib/types";
import type { Prop, Pick } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json().catch(() => ({ key: "" }));
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = process.env.ESPN_EVENT_ID;
    if (!eventId) {
      return NextResponse.json({ error: "Missing ESPN_EVENT_ID" }, { status: 500 });
    }

    const supabase = createAdminClient();

    // Fetch ESPN data with timeout protection
    let gameData: Awaited<ReturnType<typeof fetchGameData>>;
    try {
      gameData = await Promise.race([
        fetchGameData(eventId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("ESPN fetch timeout (10s)")), 10000)
        ),
      ]);
    } catch (fetchErr) {
      console.error("[POST /api/poll-game] ESPN fetch failed:", fetchErr);
      return NextResponse.json(
        { error: "Failed to fetch ESPN data" },
        { status: 502 }
      );
    }

    // Update game state
    const { error: gameStateError } = await supabase.from("game_state").update({
      home_score: gameData.homeScore,
      away_score: gameData.awayScore,
      quarter: gameData.quarter,
      clock: gameData.clock,
      status: gameData.status,
      last_play: gameData.lastPlay,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    if (gameStateError) {
      console.error("[POST /api/poll-game] game_state update failed:", gameStateError.message);
    }

    // Get all props
    const { data: props, error: propsError } = await supabase.from("props").select("*") as { data: Prop[] | null; error: { message: string } | null };
    if (propsError || !props) {
      console.error("[POST /api/poll-game] Failed to fetch props:", propsError?.message);
      return NextResponse.json({ error: "Failed to fetch props" }, { status: 500 });
    }

    // Update current values for in-progress tracking
    for (const prop of props) {
      if (prop.status === "resolved") continue;
      try {
        const currentValue = getCurrentStatValue(prop, gameData);
        if (currentValue !== null) {
          const newStatus = gameData.status === "in_progress" || gameData.status === "halftime"
            ? "in_progress"
            : prop.status;
          await supabase.from("props").update({
            current_value: currentValue,
            status: newStatus,
          }).eq("id", prop.id);
        }
      } catch (propErr) {
        console.error(`[POST /api/poll-game] Error updating prop ${prop.id}:`, propErr);
      }
    }

    // Auto-resolve props
    const resolved = resolveProps(props, gameData);
    const resolvedDetails: { propId: string; result: string; reason: string }[] = [];

    for (const r of resolved) {
      const { error: resolveError } = await supabase.from("props").update({
        status: "resolved",
        result: r.result,
      }).eq("id", r.propId);
      if (resolveError) {
        console.error(`[POST /api/poll-game] Failed to resolve prop ${r.propId}:`, resolveError.message);
      } else {
        resolvedDetails.push({ propId: r.propId, result: r.result, reason: r.reason });
      }
    }

    // Recalculate scores for all players if anything was resolved
    if (resolvedDetails.length > 0) {
      try {
        await recalculateAllScores(supabase);
      } catch (scoreErr) {
        console.error("[POST /api/poll-game] Score recalculation failed:", scoreErr);
      }
    }

    return NextResponse.json({
      gameStatus: gameData.status,
      score: `${gameData.awayScore}-${gameData.homeScore}`,
      resolved: resolvedDetails.length,
      resolvedDetails,
      quarter: gameData.quarter,
      clock: gameData.clock,
    });
  } catch (err) {
    console.error("[POST /api/poll-game] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support GET for easy cron trigger
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Forward to POST logic
    const eventId = process.env.ESPN_EVENT_ID;
    if (!eventId) {
      return NextResponse.json({ error: "Missing ESPN_EVENT_ID" }, { status: 500 });
    }

    const supabase = createAdminClient();

    let gameData: Awaited<ReturnType<typeof fetchGameData>>;
    try {
      gameData = await Promise.race([
        fetchGameData(eventId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("ESPN fetch timeout (10s)")), 10000)
        ),
      ]);
    } catch (fetchErr) {
      console.error("[GET /api/poll-game] ESPN fetch failed:", fetchErr);
      return NextResponse.json(
        { error: "Failed to fetch ESPN data" },
        { status: 502 }
      );
    }

    const { error: gameStateError } = await supabase.from("game_state").update({
      home_score: gameData.homeScore,
      away_score: gameData.awayScore,
      quarter: gameData.quarter,
      clock: gameData.clock,
      status: gameData.status,
      last_play: gameData.lastPlay,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    if (gameStateError) {
      console.error("[GET /api/poll-game] game_state update failed:", gameStateError.message);
    }

    const { data: props, error: propsError } = await supabase.from("props").select("*") as { data: Prop[] | null; error: { message: string } | null };
    if (propsError || !props) {
      console.error("[GET /api/poll-game] Failed to fetch props:", propsError?.message);
      return NextResponse.json({ error: "Failed to fetch props" }, { status: 500 });
    }

    for (const prop of props) {
      if (prop.status === "resolved") continue;
      try {
        const currentValue = getCurrentStatValue(prop, gameData);
        if (currentValue !== null) {
          const newStatus = gameData.status === "in_progress" || gameData.status === "halftime"
            ? "in_progress" : prop.status;
          await supabase.from("props").update({ current_value: currentValue, status: newStatus }).eq("id", prop.id);
        }
      } catch (propErr) {
        console.error(`[GET /api/poll-game] Error updating prop ${prop.id}:`, propErr);
      }
    }

    const resolved = resolveProps(props, gameData);
    const resolvedDetails: { propId: string; result: string; reason: string }[] = [];
    for (const r of resolved) {
      const { error: resolveError } = await supabase.from("props").update({ status: "resolved", result: r.result }).eq("id", r.propId);
      if (resolveError) {
        console.error(`[GET /api/poll-game] Failed to resolve prop ${r.propId}:`, resolveError.message);
      } else {
        resolvedDetails.push({ propId: r.propId, result: r.result, reason: r.reason });
      }
    }
    if (resolvedDetails.length > 0) {
      try {
        await recalculateAllScores(supabase);
      } catch (scoreErr) {
        console.error("[GET /api/poll-game] Score recalculation failed:", scoreErr);
      }
    }

    return NextResponse.json({
      gameStatus: gameData.status,
      score: `${gameData.awayScore}-${gameData.homeScore}`,
      resolved: resolvedDetails.length,
      resolvedDetails,
    });
  } catch (err) {
    console.error("[GET /api/poll-game] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function recalculateAllScores(supabase: ReturnType<typeof createAdminClient>) {
  const { data: players } = await supabase.from("players").select("id, name");
  const { data: allPicks } = await supabase.from("picks").select("*") as { data: Pick[] | null };
  const { data: props } = await supabase.from("props").select("*") as { data: Prop[] | null };

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
        // Update individual pick
        await supabase.from("picks").update({
          points_earned: isCorrect ? pointValue : 0,
          is_correct: isCorrect,
        }).eq("id", pick.id);
      } else {
        maxPossible += pointValue;
      }
    }

    await supabase.from("players").update({
      total_points: total,
      max_possible: maxPossible,
    }).eq("id", player.id);
  }

  // Update ranks
  const { data: ranked } = await supabase
    .from("players")
    .select("id, total_points, max_possible")
    .order("total_points", { ascending: false })
    .order("max_possible", { ascending: false });

  if (ranked) {
    for (let i = 0; i < ranked.length; i++) {
      await supabase.from("players").update({ rank: i + 1 }).eq("id", ranked[i].id);
    }
  }
}
