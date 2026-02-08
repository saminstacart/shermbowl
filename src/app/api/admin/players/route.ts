import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { oddsToPoints } from "@/lib/types";
import type { Prop, Pick } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { key, action, player_id } = body;

    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "action (string) is required" }, { status: 400 });
    }

    if (!player_id || typeof player_id !== "string") {
      return NextResponse.json({ error: "player_id (string) is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    switch (action) {
      case "view_picks": {
        const { data: player, error: playerError } = await supabase
          .from("players")
          .select("*")
          .eq("id", player_id)
          .single();

        if (playerError || !player) {
          return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        const { data: picks, error: picksError } = await supabase
          .from("picks")
          .select("*")
          .eq("player_id", player_id) as { data: Pick[] | null; error: { message: string } | null };

        if (picksError) {
          return NextResponse.json({ error: picksError.message }, { status: 500 });
        }

        const { data: props } = await supabase
          .from("props")
          .select("*")
          .order("sort_order") as { data: Prop[] | null };

        const propMap = new Map((props || []).map((p) => [p.id, p]));

        const enrichedPicks = (picks || []).map((pick) => {
          const prop = propMap.get(pick.prop_id);
          const option = prop?.options.find((o) => o.value === pick.selection);
          return {
            pick_id: pick.id,
            prop_id: pick.prop_id,
            question: prop?.question || "Unknown",
            category: prop?.category || "unknown",
            selection_value: pick.selection,
            selection_label: option?.label || pick.selection,
            odds: option?.odds || 0,
            point_value: option ? oddsToPoints(option.odds) : 0,
            is_correct: pick.is_correct,
            points_earned: pick.points_earned,
            prop_status: prop?.status || "unknown",
            prop_result: prop?.result || null,
          };
        });

        return NextResponse.json({
          player,
          picks: enrichedPicks,
          total_picks: enrichedPicks.length,
        });
      }

      case "reset_picks": {
        // Delete all picks for this player
        const { error: deleteError } = await supabase
          .from("picks")
          .delete()
          .eq("player_id", player_id);

        if (deleteError) {
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        // Reset player scores
        const { error: updateError } = await supabase
          .from("players")
          .update({
            total_points: 0,
            max_possible: 0,
            picks_count: 0,
            rank: 0,
          })
          .eq("id", player_id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: "reset_picks", player_id });
      }

      case "delete_player": {
        // Delete all picks for this player first
        const { error: picksDeleteError } = await supabase
          .from("picks")
          .delete()
          .eq("player_id", player_id);

        if (picksDeleteError) {
          return NextResponse.json({ error: picksDeleteError.message }, { status: 500 });
        }

        // Delete the player
        const { error: playerDeleteError } = await supabase
          .from("players")
          .delete()
          .eq("id", player_id);

        if (playerDeleteError) {
          return NextResponse.json({ error: playerDeleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: "delete_player", player_id });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: view_picks, reset_picks, delete_player` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[POST /api/admin/players] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
