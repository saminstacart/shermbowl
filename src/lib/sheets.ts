/**
 * Google Sheets API v4 integration for real-time sync.
 * Uses OAuth2 refresh token stored in env vars.
 */

import type { createAdminClient } from "@/lib/supabase";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth env vars");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

async function clearRange(token: string, range: string): Promise<void> {
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}:clear`;
  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function writeRange(
  token: string,
  range: string,
  values: string[][]
): Promise<void> {
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ range, values }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheet write failed for ${range}: ${res.status} ${text}`);
  }
}

interface PickRow {
  player: string;
  question: string;
  selection: string;
  points_if_correct: string;
  correct: string;
  points_earned: string;
  timestamp: string;
}

interface PlayerRow {
  name: string;
  total_points: number;
  max_possible: number;
  picks_count: number;
  rank: number;
}

interface PropRow {
  sort_order: number;
  name?: string;
  question: string;
  category: string;
  status: string;
  result?: string | null;
}

export async function syncToSheets(data: {
  picks: PickRow[];
  players: PlayerRow[];
  props?: PropRow[];
}): Promise<{ synced: boolean; error?: string }> {
  try {
    const token = await getAccessToken();

    // Sync Picks tab
    const picksHeader = [
      "Player",
      "Question",
      "Selection",
      "Points If Correct",
      "Correct",
      "Points Earned",
      "Timestamp",
    ];
    const picksRows = data.picks.map((p) => [
      p.player,
      p.question,
      p.selection,
      p.points_if_correct,
      p.correct,
      p.points_earned,
      p.timestamp,
    ]);

    await clearRange(token, "Picks!A1:G1000");
    if (picksRows.length > 0) {
      await writeRange(
        token,
        `Picks!A1:G${picksRows.length + 1}`,
        [picksHeader, ...picksRows]
      );
    } else {
      await writeRange(token, "Picks!A1:G1", [picksHeader]);
    }

    // Sync Players tab
    const playersHeader = [
      "Name",
      "Total Points",
      "Max Possible",
      "Picks Count",
      "Rank",
    ];
    const playersRows = data.players.map((p) => [
      p.name,
      String(p.total_points),
      String(p.max_possible),
      String(p.picks_count),
      String(p.rank),
    ]);

    await clearRange(token, "Players!A1:E1000");
    await writeRange(
      token,
      `Players!A1:E${playersRows.length + 1}`,
      [playersHeader, ...playersRows]
    );

    // Sync Props tab status/result columns only (G and H) if props provided
    if (data.props && data.props.length > 0) {
      const sorted = [...data.props].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      // Update just the Status (col G) and Result (col H) columns, rows 2-22
      const statusValues = sorted.map((p) => [
        p.status,
        p.result || "",
      ]);
      await writeRange(
        token,
        `Props!G2:H${statusValues.length + 1}`,
        statusValues
      );
    }

    return { synced: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sheets] Sync failed:", message);
    return { synced: false, error: message };
  }
}

/**
 * Convenience: gather data from Supabase and sync to sheets.
 * Used by poll-game and pick submission endpoints.
 */
export async function triggerSheetSync(
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  const [picksRes, playersRes, propsRes] = await Promise.all([
    supabase.from("picks").select("*").order("created_at", { ascending: true }),
    supabase.from("players").select("*"),
    supabase.from("props").select("*").order("sort_order", { ascending: true }),
  ]);

  if (picksRes.error || playersRes.error || propsRes.error) return;

  const playerMap = new Map(
    (playersRes.data || []).map((p: Record<string, unknown>) => [
      p.id,
      p.name as string,
    ])
  );
  const propMap = new Map(
    (propsRes.data || []).map((p: Record<string, unknown>) => [p.id, p])
  );

  const picks = (picksRes.data || []).map((pick: Record<string, unknown>) => {
    const prop = propMap.get(pick.prop_id) as Record<string, unknown> | undefined;
    const options = (prop?.options || []) as Array<{
      value: string;
      label: string;
      odds: number;
    }>;
    const selectedOption = options.find((o) => o.value === pick.selection);
    const points = selectedOption
      ? selectedOption.odds > 0
        ? (selectedOption.odds / 100 + 1).toFixed(2)
        : (100 / Math.abs(selectedOption.odds) + 1).toFixed(2)
      : "0";
    const isCorrect =
      prop?.result === pick.selection ? "YES" : prop?.result ? "NO" : "";

    return {
      player: (playerMap.get(pick.player_id) || String(pick.player_id)) as string,
      question: (prop?.question || String(pick.prop_id)) as string,
      selection: (selectedOption?.label || String(pick.selection)) as string,
      points_if_correct: points,
      correct: isCorrect,
      points_earned: isCorrect === "YES" ? points : isCorrect === "NO" ? "0" : "",
      timestamp: (pick.created_at || "") as string,
    };
  });

  const players = (playersRes.data || []).map((p: Record<string, unknown>) => ({
    name: p.name as string,
    total_points: (p.total_points || 0) as number,
    max_possible: (p.max_possible || 0) as number,
    picks_count: (p.picks_count || 0) as number,
    rank: (p.rank || 0) as number,
  }));

  const props = (propsRes.data || []).map((p: Record<string, unknown>) => ({
    sort_order: (p.sort_order || 0) as number,
    name: p.name as string | undefined,
    question: p.question as string,
    category: p.category as string,
    status: p.status as string,
    result: p.result as string | null,
  }));

  await syncToSheets({ picks, players, props });
}
