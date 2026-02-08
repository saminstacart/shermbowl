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

    const { key, prop_id, result } = body;

    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!prop_id || typeof prop_id !== "string") {
      return NextResponse.json({ error: "prop_id (string) is required" }, { status: 400 });
    }
    if (!result || typeof result !== "string") {
      return NextResponse.json({ error: "result (string) is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Update prop
    const { data: prop, error: propError } = await supabase
      .from("props")
      .update({ status: "resolved", result })
      .eq("id", prop_id)
      .select()
      .single() as { data: Prop | null; error: { message: string } | null };

    if (propError || !prop) {
      return NextResponse.json({ error: propError?.message || "Prop not found" }, { status: 500 });
    }

    // Update all picks for this prop
    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("*")
      .eq("prop_id", prop_id) as { data: Pick[] | null; error: { message: string } | null };

    if (picksError) {
      console.error("[POST /api/resolve-prop] Failed to fetch picks:", picksError.message);
    }

    if (picks) {
      for (const pick of picks) {
        const option = prop.options.find((o) => o.value === pick.selection);
        const isCorrect = pick.selection === result;
        const pointsEarned = isCorrect && option ? oddsToPoints(option.odds) : 0;

        const { error: pickUpdateError } = await supabase.from("picks").update({
          is_correct: isCorrect,
          points_earned: pointsEarned,
        }).eq("id", pick.id);

        if (pickUpdateError) {
          console.error(`[POST /api/resolve-prop] Failed to update pick ${pick.id}:`, pickUpdateError.message);
        }
      }
    }

    // Recalculate player totals
    try {
      const { data: players } = await supabase.from("players").select("id");
      const { data: allPicks } = await supabase.from("picks").select("*") as { data: Pick[] | null };
      const { data: allProps } = await supabase.from("props").select("*") as { data: Prop[] | null };

      if (players && allPicks && allProps) {
        const propMap = new Map(allProps.map((p) => [p.id, p]));

        for (const player of players) {
          const playerPicks = allPicks.filter((p) => p.player_id === player.id);
          let total = 0;
          let maxPossible = 0;

          for (const pick of playerPicks) {
            const p = propMap.get(pick.prop_id);
            if (!p) continue;
            const opt = p.options.find((o) => o.value === pick.selection);
            if (!opt) continue;
            const pv = oddsToPoints(opt.odds);

            if (p.status === "resolved") {
              if (p.result === pick.selection) {
                total += pv;
                maxPossible += pv;
              }
            } else {
              maxPossible += pv;
            }
          }

          await supabase.from("players").update({
            total_points: total,
            max_possible: maxPossible,
          }).eq("id", player.id);
        }

        // Rerank
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
    } catch (scoreErr) {
      console.error("[POST /api/resolve-prop] Score recalculation failed:", scoreErr);
      // Don't fail the request — the prop was already resolved successfully
    }

    return NextResponse.json({ success: true, prop_id, result });
  } catch (err) {
    console.error("[POST /api/resolve-prop] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
