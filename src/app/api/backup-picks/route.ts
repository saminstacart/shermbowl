import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "17NcpJsQyTTZXxzOpse1mJhcGMi2tldP39WtQ9vxnQa4";

// This endpoint dumps all picks to a format that can be pasted into Google Sheets
// or consumed by an external backup service. Admin-only.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Get all picks with player and prop info
    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("*")
      .order("created_at", { ascending: true });

    if (picksError) {
      return NextResponse.json({ error: picksError.message }, { status: 500 });
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*");

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    const { data: props, error: propsError } = await supabase
      .from("props")
      .select("*")
      .order("sort_order", { ascending: true });

    if (propsError) {
      return NextResponse.json({ error: propsError.message }, { status: 500 });
    }

    // Build lookup maps
    const playerMap = new Map(
      (players || []).map((p: Record<string, unknown>) => [p.id, p.name])
    );
    const propMap = new Map(
      (props || []).map((p: Record<string, unknown>) => [p.id, p])
    );

    // Format picks for sheets
    const picksRows = (picks || []).map((pick: Record<string, unknown>) => {
      const prop = propMap.get(pick.prop_id) as Record<string, unknown> | undefined;
      const options = (prop?.options || []) as Array<{ value: string; label: string; odds: number }>;
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
        player: playerMap.get(pick.player_id) || pick.player_id,
        question: prop?.question || pick.prop_id,
        selection: selectedOption?.label || pick.selection,
        points_if_correct: points,
        correct: isCorrect,
        points_earned:
          isCorrect === "YES" ? points : isCorrect === "NO" ? "0" : "",
        timestamp: pick.created_at || "",
      };
    });

    // Format players for sheets
    const playersRows = (players || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      total_points: p.total_points,
      max_possible: p.max_possible,
      picks_count: p.picks_count,
      rank: p.rank,
    }));

    return NextResponse.json({
      sheet_id: SHEET_ID,
      sheet_url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
      picks_count: picksRows.length,
      players_count: playersRows.length,
      props_count: (props || []).length,
      picks: picksRows,
      players: playersRows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST handler - backup data with timestamp for admin panel
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { key } = body;
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const [picksRes, playersRes, propsRes, gameRes] = await Promise.all([
      supabase.from("picks").select("*").order("created_at", { ascending: true }),
      supabase.from("players").select("*"),
      supabase.from("props").select("*").order("sort_order", { ascending: true }),
      supabase.from("game_state").select("*").eq("id", 1).single(),
    ]);

    if (picksRes.error) return NextResponse.json({ error: picksRes.error.message }, { status: 500 });
    if (playersRes.error) return NextResponse.json({ error: playersRes.error.message }, { status: 500 });
    if (propsRes.error) return NextResponse.json({ error: propsRes.error.message }, { status: 500 });

    const playerMap = new Map(
      (playersRes.data || []).map((p: Record<string, unknown>) => [p.id, p.name])
    );
    const propMap = new Map(
      (propsRes.data || []).map((p: Record<string, unknown>) => [p.id, p])
    );

    const picksRows = (picksRes.data || []).map((pick: Record<string, unknown>) => {
      const prop = propMap.get(pick.prop_id) as Record<string, unknown> | undefined;
      const options = (prop?.options || []) as Array<{ value: string; label: string; odds: number }>;
      const selectedOption = options.find((o) => o.value === pick.selection);
      const points = selectedOption
        ? selectedOption.odds > 0
          ? (selectedOption.odds / 100 + 1).toFixed(2)
          : (100 / Math.abs(selectedOption.odds) + 1).toFixed(2)
        : "0";
      const isCorrect =
        prop?.result === pick.selection ? "YES" : prop?.result ? "NO" : "";

      return {
        player: playerMap.get(pick.player_id) || pick.player_id,
        question: prop?.question || pick.prop_id,
        selection: selectedOption?.label || pick.selection,
        points_if_correct: points,
        correct: isCorrect,
        points_earned: isCorrect === "YES" ? points : isCorrect === "NO" ? "0" : "",
        timestamp: pick.created_at || "",
      };
    });

    const playersRows = (playersRes.data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      total_points: p.total_points,
      max_possible: p.max_possible,
      picks_count: p.picks_count,
      rank: p.rank,
    }));

    return NextResponse.json({
      success: true,
      backed_up_at: new Date().toISOString(),
      sheet_id: SHEET_ID,
      sheet_url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
      picks_count: picksRows.length,
      players_count: playersRows.length,
      props_count: (propsRes.data || []).length,
      game_state: gameRes.data || null,
      picks: picksRows,
      players: playersRows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
