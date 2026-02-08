import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get("player_id");
    const adminKey = req.nextUrl.searchParams.get("key");
    const supabase = createAdminClient();

    // Before lock time, only allow fetching your own picks (require player_id)
    // After lock time or with admin key, allow fetching all picks
    const lockTime = new Date(process.env.NEXT_PUBLIC_LOCK_TIME || "");
    const isLocked = new Date() > lockTime;
    const isAdmin = adminKey === process.env.ADMIN_SECRET;

    if (!playerId && !isLocked && !isAdmin) {
      return NextResponse.json({ error: "player_id is required before lock" }, { status: 400 });
    }

    let query = supabase.from("picks").select("*");

    if (playerId) {
      if (typeof playerId !== "string" || playerId.trim().length === 0) {
        return NextResponse.json({ error: "Invalid player_id" }, { status: 400 });
      }
      // Before lock, only return YOUR picks. After lock or admin, return requested player's picks.
      query = query.eq("player_id", playerId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/picks] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { player_id, picks, lock_in } = body;

    if (!player_id || typeof player_id !== "string") {
      return NextResponse.json({ error: "player_id (string) is required" }, { status: 400 });
    }
    if (!Array.isArray(picks)) {
      return NextResponse.json({ error: "picks array is required" }, { status: 400 });
    }

    // Validate each pick has required fields
    for (const p of picks) {
      if (!p || typeof p.prop_id !== "string" || typeof p.selection !== "string") {
        return NextResponse.json(
          { error: "Each pick must have prop_id (string) and selection (string)" },
          { status: 400 }
        );
      }
    }

    // Check lock time
    const lockTime = new Date(process.env.NEXT_PUBLIC_LOCK_TIME || "");
    if (new Date() > lockTime) {
      return NextResponse.json({ error: "Picks are locked" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Validate player exists
    const { data: playerExists, error: playerErr } = await supabase
      .from("players")
      .select("id")
      .eq("id", player_id)
      .single();

    if (playerErr || !playerExists) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Validate all prop_ids and selections exist
    const { data: allProps } = await supabase.from("props").select("id, options");
    if (allProps) {
      const propMap = new Map(
        allProps.map((p: { id: string; options: Array<{ value: string }> }) => [p.id, p.options])
      );
      for (const p of picks) {
        const options = propMap.get(p.prop_id);
        if (!options) {
          return NextResponse.json(
            { error: `Prop '${p.prop_id}' not found` },
            { status: 400 }
          );
        }
        if (!options.some((o: { value: string }) => o.value === p.selection)) {
          return NextResponse.json(
            { error: `Invalid selection '${p.selection}' for prop '${p.prop_id}'` },
            { status: 400 }
          );
        }
      }
    }

    // Redundant server-side lock check for lock_in requests
    if (lock_in) {
      const now = new Date();
      if (now > lockTime) {
        return NextResponse.json({ error: "Picks are locked (server time check)" }, { status: 403 });
      }
    }

    // If locking in, validate all props have selections
    if (lock_in) {
      const { count: totalProps, error: countError } = await supabase
        .from("props")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("[POST /api/picks] Error counting props:", countError.message);
        return NextResponse.json({ error: "Failed to validate props count" }, { status: 500 });
      }

      if (totalProps && picks.length < totalProps) {
        return NextResponse.json(
          { error: `Must pick all ${totalProps} props before locking in. You have ${picks.length}.` },
          { status: 400 }
        );
      }
    }

    // Upsert each pick
    const upserts = picks.map((p: { prop_id: string; selection: string }) => ({
      player_id,
      prop_id: p.prop_id,
      selection: p.selection,
    }));

    const { error } = await supabase.from("picks").upsert(upserts, {
      onConflict: "player_id,prop_id",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update picks count (non-critical — don't fail the request if this errors)
    try {
      const { count } = await supabase
        .from("picks")
        .select("*", { count: "exact", head: true })
        .eq("player_id", player_id);

      await supabase
        .from("players")
        .update({ picks_count: count || 0 })
        .eq("id", player_id);
    } catch (countErr) {
      console.error("[POST /api/picks] Error updating picks count:", countErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/picks] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
