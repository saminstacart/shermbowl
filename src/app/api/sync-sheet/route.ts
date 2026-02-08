import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { syncToSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/**
 * Syncs current state to Google Sheets.
 * Called automatically by poll-game and after pick submissions.
 * Can also be called manually: GET /api/sync-sheet?key=ADMIN_SECRET
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return doSync();
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json().catch(() => ({ key: "" }));
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return doSync();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

async function doSync() {
  const supabase = createAdminClient();

  const [picksRes, playersRes, propsRes] = await Promise.all([
    supabase.from("picks").select("*").order("created_at", { ascending: true }),
    supabase.from("players").select("*"),
    supabase
      .from("props")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  if (picksRes.error || playersRes.error || propsRes.error) {
    return NextResponse.json(
      {
        error: "DB fetch failed",
        details: {
          picks: picksRes.error?.message,
          players: playersRes.error?.message,
          props: propsRes.error?.message,
        },
      },
      { status: 500 }
    );
  }

  const playerMap = new Map(
    (playersRes.data || []).map((p: Record<string, unknown>) => [
      p.id,
      p.name as string,
    ])
  );
  const propMap = new Map(
    (propsRes.data || []).map((p: Record<string, unknown>) => [p.id, p])
  );

  // Format picks
  const picks = (picksRes.data || []).map((pick: Record<string, unknown>) => {
    const prop = propMap.get(pick.prop_id) as Record<string, unknown> | undefined;
    const options = (prop?.options || []) as Array<{
      value: string;
      label: string;
      odds: number;
    }>;
    const selectedOption = options.find(
      (o) => o.value === pick.selection
    );
    const points = selectedOption
      ? selectedOption.odds > 0
        ? (selectedOption.odds / 100 + 1).toFixed(2)
        : (100 / Math.abs(selectedOption.odds) + 1).toFixed(2)
      : "0";
    const isCorrect =
      prop?.result === pick.selection
        ? "YES"
        : prop?.result
        ? "NO"
        : "";

    return {
      player: (playerMap.get(pick.player_id) || String(pick.player_id)) as string,
      question: (prop?.question || String(pick.prop_id)) as string,
      selection: (selectedOption?.label || String(pick.selection)) as string,
      points_if_correct: points,
      correct: isCorrect,
      points_earned:
        isCorrect === "YES" ? points : isCorrect === "NO" ? "0" : "",
      timestamp: (pick.created_at || "") as string,
    };
  });

  // Format players
  const players = (playersRes.data || []).map((p: Record<string, unknown>) => ({
    name: p.name as string,
    total_points: (p.total_points || 0) as number,
    max_possible: (p.max_possible || 0) as number,
    picks_count: (p.picks_count || 0) as number,
    rank: (p.rank || 0) as number,
  }));

  // Format props
  const props = (propsRes.data || []).map((p: Record<string, unknown>) => ({
    sort_order: (p.sort_order || 0) as number,
    name: p.name as string | undefined,
    question: p.question as string,
    category: p.category as string,
    status: p.status as string,
    result: p.result as string | null,
  }));

  const result = await syncToSheets({ picks, players, props });

  return NextResponse.json({
    ...result,
    picks_count: picks.length,
    players_count: players.length,
    props_count: props.length,
    synced_at: new Date().toISOString(),
  });
}
