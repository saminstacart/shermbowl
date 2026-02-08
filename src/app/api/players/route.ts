import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiting (resets on deploy)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  // Clean up expired entries periodically
  if (rateLimits.size > 100) {
    for (const [key, val] of rateLimits) {
      if (now > val.resetAt) rateLimits.delete(key);
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const ALLOWED_NAMES = [
  "Sam",
  "Adam",
  "Brian",
  "John",
  "Arjun",
  "Spencer",
  "Jin",
  "Justin",
  "Russ",
  "Miguel",
];

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("rank", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/players] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a minute." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Validate against allowed names (case-insensitive), use canonical casing
    const canonical = ALLOWED_NAMES.find(
      (n) => n.toLowerCase() === name.trim().toLowerCase()
    );
    if (!canonical) {
      return NextResponse.json(
        { error: "Name not recognized. Please pick from the list." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if name exists
    const { data: existing, error: existingError } = await supabase
      .from("players")
      .select("id, name, picks_count")
      .ilike("name", canonical)
      .single();

    if (existingError && existingError.code !== "PGRST116") {
      // PGRST116 = "no rows returned" which is expected for new players
      console.error("[POST /api/players] Error checking existing player:", existingError.message);
    }

    if (existing) {
      return NextResponse.json({
        id: existing.id,
        name: existing.name,
        is_returning: true,
        picks_count: existing.picks_count ?? 0,
      });
    }

    const { data, error } = await supabase
      .from("players")
      .insert({ name: canonical })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique violation — race condition, just fetch
        const { data: fetched } = await supabase
          .from("players")
          .select("id, name, picks_count")
          .ilike("name", canonical)
          .single();
        return NextResponse.json({
          id: fetched?.id,
          name: fetched?.name,
          is_returning: true,
          picks_count: fetched?.picks_count ?? 0,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: data.id,
        name: data.name,
        is_returning: false,
        picks_count: 0,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/players] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
