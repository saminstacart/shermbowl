import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { fetchSuperBowlProps } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Admin only
  const { key } = await req.json();
  if (key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.THE_ODDS_API_KEY;
  const eventId = process.env.ODDS_EVENT_ID;

  if (!apiKey || !eventId) {
    return NextResponse.json(
      { error: "Missing THE_ODDS_API_KEY or ODDS_EVENT_ID" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();

  // Clear existing props (reseed)
  await supabase.from("picks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("props").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Fetch from Odds API
  const seedProps = await fetchSuperBowlProps(apiKey, eventId);

  // Insert into Supabase
  const rows = seedProps.map((p) => ({
    category: p.category,
    question: p.question,
    prop_type: p.prop_type,
    options: p.options,
    status: "pending",
    sort_order: p.sort_order,
    stat_key: p.stat_key,
    threshold: p.threshold,
    auto_resolve: p.auto_resolve,
    player_name: p.player_name,
  }));

  const { data, error } = await supabase.from("props").insert(rows).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data.length, props: data });
}
