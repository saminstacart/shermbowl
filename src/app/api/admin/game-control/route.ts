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

    const { key, action, value } = body;

    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "action (string) is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    switch (action) {
      case "set_status": {
        const validStatuses = ["pre", "in_progress", "halftime", "final"];
        if (!value || !validStatuses.includes(value as string)) {
          return NextResponse.json(
            { error: `Invalid status. Valid: ${validStatuses.join(", ")}` },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("game_state")
          .update({
            status: value as string,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: "set_status", status: value });
      }

      case "extend_lock": {
        return NextResponse.json({
          success: true,
          action: "extend_lock",
          message:
            "NEXT_PUBLIC_LOCK_TIME is an environment variable. To extend the lock time by 15 minutes, update the variable in your Vercel dashboard or run: echo \"NEW_ISO_TIME\" | npx vercel env add NEXT_PUBLIC_LOCK_TIME production --yes",
          current_env: process.env.NEXT_PUBLIC_LOCK_TIME || "not set",
          suggested_value: new Date(
            Date.now() + 15 * 60 * 1000
          ).toISOString(),
        });
      }

      case "force_lock": {
        return NextResponse.json({
          success: true,
          action: "force_lock",
          message:
            "NEXT_PUBLIC_LOCK_TIME is an environment variable. To force lock now, set it to a past time in Vercel or run: echo \"PAST_ISO_TIME\" | npx vercel env add NEXT_PUBLIC_LOCK_TIME production --yes",
          current_env: process.env.NEXT_PUBLIC_LOCK_TIME || "not set",
          suggested_value: new Date().toISOString(),
        });
      }

      case "recalculate_scores": {
        const { data: players } = await supabase.from("players").select("id");
        const { data: allPicks } = await supabase
          .from("picks")
          .select("*") as { data: Pick[] | null };
        const { data: allProps } = await supabase
          .from("props")
          .select("*") as { data: Prop[] | null };

        if (!players || !allPicks || !allProps) {
          return NextResponse.json({ error: "Failed to fetch data for recalculation" }, { status: 500 });
        }

        const propMap = new Map(allProps.map((p) => [p.id, p]));

        for (const player of players) {
          const playerPicks = allPicks.filter((p) => p.player_id === player.id);
          let total = 0;
          let maxPossible = 0;

          for (const pick of playerPicks) {
            const prop = propMap.get(pick.prop_id);
            if (!prop) continue;
            const opt = prop.options.find((o) => o.value === pick.selection);
            if (!opt) continue;
            const pv = oddsToPoints(opt.odds);

            if (prop.status === "resolved") {
              const isCorrect = prop.result === pick.selection;
              if (isCorrect) {
                total += pv;
                maxPossible += pv;
              }
              await supabase
                .from("picks")
                .update({
                  points_earned: isCorrect ? pv : 0,
                  is_correct: isCorrect,
                })
                .eq("id", pick.id);
            } else {
              maxPossible += pv;
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

        // Rerank
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

        return NextResponse.json({
          success: true,
          action: "recalculate_scores",
          players_updated: players.length,
          picks_processed: allPicks.length,
        });
      }

      case "run_mock_step": {
        const step = Number(value);
        if (!step || step < 1) {
          return NextResponse.json({ error: "value must be a valid step number (1+)" }, { status: 400 });
        }

        // Forward to mock-game endpoint
        const baseUrl = req.nextUrl.origin;
        const res = await fetch(`${baseUrl}/api/mock-game`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: key as string, step }),
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: set_status, extend_lock, force_lock, recalculate_scores, run_mock_step` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[POST /api/admin/game-control] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
