"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Prop, Player, Pick, GameState } from "@/lib/types";
import { formatOdds, oddsToPoints, formatPoints } from "@/lib/types";

const EXPECTED_PLAYERS = [
  "Sam", "Adam", "Brian", "John", "Arjun",
  "Spencer", "Jin", "Justin", "Russ", "Miguel",
];

export default function AdminPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#09090b]"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <AdminPage />
    </Suspense>
  );
}

function AdminPage() {
  const searchParams = useSearchParams();
  const adminKey = searchParams.get("key") || "";
  const [props, setProps] = useState<Prop[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedStatus, setSeedStatus] = useState("");
  const [pollStatus, setPollStatus] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Player management
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [playerPicks, setPlayerPicks] = useState<Record<string, unknown>[]>([]);
  const [playerPicksLoading, setPlayerPicksLoading] = useState(false);

  // Game control
  const [mockStep, setMockStep] = useState(1);
  const [gameControlStatus, setGameControlStatus] = useState("");

  // Health check
  const [healthStatus, setHealthStatus] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [healthLoading, setHealthLoading] = useState(false);

  // New prop form
  const [newQuestion, setNewQuestion] = useState("");
  const [newCategory, setNewCategory] = useState<"game" | "player" | "fun" | "degen">("fun");
  const [newPropType, setNewPropType] = useState<"binary" | "over_under" | "multi_choice">("binary");
  const [newOptions, setNewOptions] = useState([
    { label: "", odds: 100, value: "" },
    { label: "", odds: -100, value: "" },
  ]);

  // Active section
  const [activeSection, setActiveSection] = useState<string>("overview");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const [propsRes, playersRes, picksRes, gameRes] = await Promise.all([
        supabase.from("props").select("*").order("sort_order"),
        supabase.from("players").select("*").order("rank"),
        supabase.from("picks").select("*"),
        supabase.from("game_state").select("*").eq("id", 1).single(),
      ]);
      if (propsRes.data) setProps(propsRes.data as Prop[]);
      if (playersRes.data) setPlayers(playersRes.data as Player[]);
      if (picksRes.data) setAllPicks(picksRes.data as Pick[]);
      if (gameRes.data) setGameState(gameRes.data as GameState);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (adminKey === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      setAuthorized(true);
      fetchAll();
    }
  }, [adminKey, fetchAll]);

  const handleSeedCurated = async () => {
    setConfirmAction({
      title: "Seed Curated Props",
      message: "This will DELETE all existing props and picks, then insert the 21 curated props. Players will keep their accounts but lose all picks. Are you sure?",
      onConfirm: async () => {
        setConfirmAction(null);
        setSeedStatus("Seeding curated props...");
        try {
          const res = await fetch("/api/seed-curated", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: adminKey }),
          });
          const data = await res.json();
          setSeedStatus(res.ok ? `Seeded ${data.count} curated props` : `Error: ${data.error}`);
          fetchAll();
        } catch (e) {
          setSeedStatus(`Error: ${e}`);
        }
      },
    });
  };

  const handleSeedOddsApi = async () => {
    setConfirmAction({
      title: "Seed from Odds API",
      message: "This will DELETE all existing props and picks, then fetch fresh props from The Odds API. Are you sure?",
      onConfirm: async () => {
        setConfirmAction(null);
        setSeedStatus("Seeding from Odds API...");
        try {
          const res = await fetch("/api/seed-props", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: adminKey }),
          });
          const data = await res.json();
          setSeedStatus(res.ok ? `Seeded ${data.count} props from API` : `Error: ${data.error}`);
          fetchAll();
        } catch (e) {
          setSeedStatus(`Error: ${e}`);
        }
      },
    });
  };

  const handlePoll = async () => {
    setPollStatus("Polling...");
    try {
      const res = await fetch("/api/poll-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey }),
      });
      const data = await res.json();
      setPollStatus(res.ok ? JSON.stringify(data) : `Error: ${data.error}`);
      fetchAll();
    } catch (e) {
      setPollStatus(`Error: ${e}`);
    }
  };

  const handleResolve = async (propId: string, result: string, propName: string) => {
    const option = props.find((p) => p.id === propId)?.options.find((o) => o.value === result);
    setConfirmAction({
      title: "Resolve Prop",
      message: `Resolve "${propName}" as "${option?.label || result}"? This will score all picks on this prop.`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await fetch("/api/resolve-prop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: adminKey, prop_id: propId, result }),
          });
          fetchAll();
        } catch {}
      },
    });
  };

  const handleUndoResolve = async (propId: string, propName: string) => {
    setConfirmAction({
      title: "Undo Resolution",
      message: `Un-resolve "${propName}"? This will reset the result and recalculate all scores.`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          const { supabase } = await import("@/lib/supabase");
          await supabase.from("props").update({ status: "pending", result: null }).eq("id", propId);
          await supabase.from("picks").update({ is_correct: null, points_earned: null }).eq("prop_id", propId);
          await fetch("/api/poll-game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: adminKey }),
          }).catch(() => {});
          fetchAll();
        } catch {}
      },
    });
  };

  const handleAddProp = async () => {
    if (!newQuestion.trim()) return;
    const { supabase } = await import("@/lib/supabase");
    const options = newOptions
      .filter((o) => o.label.trim())
      .map((o) => ({
        label: o.label.trim(),
        odds: Number(o.odds),
        value: o.label.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"),
      }));
    if (options.length < 2) return;
    const maxSort = Math.max(0, ...props.map((p) => p.sort_order));
    await supabase.from("props").insert({
      category: newCategory,
      question: newQuestion.trim(),
      prop_type: newPropType,
      options,
      status: "pending",
      sort_order: maxSort + 1,
      auto_resolve: false,
    });
    setNewQuestion("");
    setNewOptions([
      { label: "", odds: 100, value: "" },
      { label: "", odds: -100, value: "" },
    ]);
    fetchAll();
  };

  // Player management handlers
  const handleViewPicks = async (playerId: string) => {
    if (expandedPlayer === playerId) {
      setExpandedPlayer(null);
      return;
    }
    setExpandedPlayer(playerId);
    setPlayerPicksLoading(true);
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, action: "view_picks", player_id: playerId }),
      });
      const data = await res.json();
      setPlayerPicks(data.picks || []);
    } catch {
      setPlayerPicks([]);
    }
    setPlayerPicksLoading(false);
  };

  const handleResetPicks = (playerId: string, playerName: string) => {
    setConfirmAction({
      title: "Reset Player Picks",
      message: `Delete ALL picks for "${playerName}" and reset their score to 0? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await fetch("/api/admin/players", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: adminKey, action: "reset_picks", player_id: playerId }),
          });
          fetchAll();
        } catch {}
      },
    });
  };

  const handleDeletePlayer = (playerId: string, playerName: string) => {
    setConfirmAction({
      title: "Delete Player",
      message: `Permanently delete "${playerName}" and all their picks? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await fetch("/api/admin/players", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: adminKey, action: "delete_player", player_id: playerId }),
          });
          fetchAll();
        } catch {}
      },
    });
  };

  // Game control handlers
  const handleSetStatus = async (status: string) => {
    setGameControlStatus("Updating...");
    try {
      const res = await fetch("/api/admin/game-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, action: "set_status", value: status }),
      });
      const data = await res.json();
      setGameControlStatus(res.ok ? `Status set to ${status}` : `Error: ${data.error}`);
      fetchAll();
    } catch (e) {
      setGameControlStatus(`Error: ${e}`);
    }
  };

  const handleRecalculate = async () => {
    setGameControlStatus("Recalculating all scores...");
    try {
      const res = await fetch("/api/admin/game-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, action: "recalculate_scores" }),
      });
      const data = await res.json();
      setGameControlStatus(
        res.ok
          ? `Recalculated: ${data.players_updated} players, ${data.picks_processed} picks`
          : `Error: ${data.error}`
      );
      fetchAll();
    } catch (e) {
      setGameControlStatus(`Error: ${e}`);
    }
  };

  const handleMockStep = async () => {
    setGameControlStatus(`Running mock step ${mockStep}...`);
    try {
      const res = await fetch("/api/admin/game-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, action: "run_mock_step", value: mockStep }),
      });
      const data = await res.json();
      setGameControlStatus(res.ok ? `Step ${mockStep}: ${data.label || "done"}` : `Error: ${data.error}`);
      fetchAll();
    } catch (e) {
      setGameControlStatus(`Error: ${e}`);
    }
  };

  const handleLockExtend = async () => {
    const res = await fetch("/api/admin/game-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: adminKey, action: "extend_lock" }),
    });
    const data = await res.json();
    setGameControlStatus(data.message || "See Vercel env vars");
  };

  const handleForceLock = async () => {
    const res = await fetch("/api/admin/game-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: adminKey, action: "force_lock" }),
    });
    const data = await res.json();
    setGameControlStatus(data.message || "See Vercel env vars");
  };

  // Health check
  const runHealthCheck = async () => {
    setHealthLoading(true);
    const results: Record<string, { ok: boolean; detail: string }> = {};

    // Supabase ping
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase.from("game_state").select("id").eq("id", 1).single();
      results.supabase = error
        ? { ok: false, detail: error.message }
        : { ok: !!data, detail: data ? "Connected" : "No game_state row" };
    } catch (e) {
      results.supabase = { ok: false, detail: String(e) };
    }

    // Props integrity
    const propsWithMissingOptions = props.filter(
      (p) => !p.options || p.options.length < 2
    );
    results.props = {
      ok: propsWithMissingOptions.length === 0 && props.length > 0,
      detail: props.length === 0
        ? "No props seeded"
        : propsWithMissingOptions.length > 0
        ? `${propsWithMissingOptions.length} props with missing options`
        : `${props.length} props, all valid`,
    };

    // Players
    const playerNames = players.map((p) => p.name);
    const missingPlayers = EXPECTED_PLAYERS.filter(
      (n) => !playerNames.some((pn) => pn.toLowerCase() === n.toLowerCase())
    );
    const playersWithPicks = players.filter(
      (p) => allPicks.some((pick) => pick.player_id === p.id)
    );
    results.players = {
      ok: missingPlayers.length === 0,
      detail: `${players.length}/${EXPECTED_PLAYERS.length} joined. ${playersWithPicks.length} have picks.${
        missingPlayers.length > 0 ? ` Missing: ${missingPlayers.join(", ")}` : ""
      }`,
    };

    // Lock time
    const lockTime = process.env.NEXT_PUBLIC_LOCK_TIME;
    if (lockTime) {
      const lockDate = new Date(lockTime);
      const isInFuture = lockDate > new Date();
      results.lockTime = {
        ok: isInFuture,
        detail: isInFuture
          ? `Locks at ${lockDate.toLocaleString()}`
          : `Lock time is in the past: ${lockDate.toLocaleString()}`,
      };
    } else {
      results.lockTime = { ok: false, detail: "NEXT_PUBLIC_LOCK_TIME not set" };
    }

    // Game state
    results.gameStatus = gameState
      ? { ok: true, detail: `Status: ${gameState.status}` }
      : { ok: false, detail: "No game state found" };

    setHealthStatus(results);
    setHealthLoading(false);
  };

  // Export JSON
  const handleExportJson = async () => {
    try {
      const res = await fetch(`/api/backup-picks?key=${adminKey}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shermbowl-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem("shermbowl_last_backup", new Date().toISOString());
    } catch {}
  };

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <p className="text-red-400">Unauthorized. Add ?key=YOUR_SECRET to the URL.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const buyIn = 50;
  const playerCount = players.length;
  const pot = buyIn * playerCount;

  const playerNames = players.map((p) => p.name);
  const missingPlayers = EXPECTED_PLAYERS.filter(
    (n) => !playerNames.some((pn) => pn.toLowerCase() === n.toLowerCase())
  );

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "players", label: "Players" },
    { id: "game", label: "Game Control" },
    { id: "props", label: "Props" },
    { id: "health", label: "Health" },
    { id: "backup", label: "Backup" },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7]">
      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f0f13] border border-[#27272a] rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">{confirmAction.title}</h3>
            <p className="text-sm text-[#71717a]">{confirmAction.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 border border-[#27272a] text-[#e4e4e7] rounded-xl text-sm font-medium hover:bg-[#16161c]"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#27272a] bg-[#0f0f13]">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-white">ShermBowl Admin</h1>
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? "bg-green-500 text-[#09090b]"
                    : "bg-[#16161c] text-[#71717a] hover:text-[#e4e4e7]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* ========== OVERVIEW ========== */}
        {activeSection === "overview" && (
          <>
            {/* Contest Settings */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-[#e4e4e7]">Contest Settings</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-[#16161c] rounded-lg p-3">
                  <div className="text-lg font-bold text-green-500">${buyIn}</div>
                  <div className="text-[11px] text-[#71717a]">Buy-In</div>
                </div>
                <div className="bg-[#16161c] rounded-lg p-3">
                  <div className="text-lg font-bold text-white">{playerCount}</div>
                  <div className="text-[11px] text-[#71717a]">Players</div>
                </div>
                <div className="bg-[#16161c] rounded-lg p-3">
                  <div className="text-lg font-bold text-amber-400">${pot}</div>
                  <div className="text-[11px] text-[#71717a]">Pot</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center text-xs">
                <div>
                  <span className="text-green-500 font-bold">${Math.round(pot * 0.6)}</span>
                  <span className="text-[#71717a] ml-1">1st (60%)</span>
                </div>
                <div>
                  <span className="text-blue-400 font-bold">${Math.round(pot * 0.3)}</span>
                  <span className="text-[#71717a] ml-1">2nd (30%)</span>
                </div>
                <div>
                  <span className="text-orange-400 font-bold">${Math.round(pot * 0.1)}</span>
                  <span className="text-[#71717a] ml-1">3rd (10%)</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-[#0f0f13] border border-[#27272a] rounded-xl p-4">
                <div className="text-2xl font-bold text-green-500">{props.length}</div>
                <div className="text-[11px] text-[#71717a]">Total Props</div>
              </div>
              <div className="bg-[#0f0f13] border border-[#27272a] rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{players.length}</div>
                <div className="text-[11px] text-[#71717a]">Players</div>
              </div>
              <div className="bg-[#0f0f13] border border-[#27272a] rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-400">
                  {props.filter((p) => p.status === "resolved").length}
                </div>
                <div className="text-[11px] text-[#71717a]">Resolved</div>
              </div>
              <div className="bg-[#0f0f13] border border-[#27272a] rounded-xl p-4">
                <div className="text-2xl font-bold text-amber-400">
                  {gameState?.status || "?"}
                </div>
                <div className="text-[11px] text-[#71717a]">Game Status</div>
              </div>
            </div>

            {/* Picks Progress — who needs nudging */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-[#e4e4e7]">Picks Progress</h2>
              <div className="space-y-2">
                {(() => {
                  // Show all expected players, joined or not
                  const rows = EXPECTED_PLAYERS.map((name) => {
                    const player = players.find(
                      (p) => p.name.toLowerCase() === name.toLowerCase()
                    );
                    const pickCount = player
                      ? allPicks.filter((p) => p.player_id === player.id).length
                      : 0;
                    const joined = !!player;
                    const done = pickCount >= props.length && props.length > 0;
                    return { name, joined, pickCount, done };
                  });
                  const sortedRows = [...rows].sort((a, b) => {
                    // Not joined first, then by picks ascending
                    if (!a.joined && b.joined) return -1;
                    if (a.joined && !b.joined) return 1;
                    return a.pickCount - b.pickCount;
                  });
                  return sortedRows.map((r) => (
                    <div key={r.name} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        !r.joined ? "bg-red-500" : r.done ? "bg-green-500" : "bg-amber-500"
                      }`} />
                      <span className={`text-sm font-medium w-20 ${
                        !r.joined ? "text-red-400" : r.done ? "text-green-400" : "text-white"
                      }`}>
                        {r.name}
                      </span>
                      {!r.joined ? (
                        <span className="text-[11px] text-red-400">Not joined</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex-1 h-1.5 bg-[#1a1a1f] rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                r.done ? "bg-green-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${props.length > 0 ? (r.pickCount / props.length) * 100 : 0}%` }}
                            />
                          </div>
                          <span className={`text-[11px] tabular-nums ${
                            r.done ? "text-green-500" : "text-[#71717a]"
                          }`}>
                            {r.pickCount}/{props.length}
                          </span>
                          {r.done && <span className="text-[11px] text-green-500">Done</span>}
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
              {(() => {
                const joinedCount = players.filter((p) =>
                  EXPECTED_PLAYERS.some((n) => n.toLowerCase() === p.name.toLowerCase())
                ).length;
                const doneCount = EXPECTED_PLAYERS.filter((name) => {
                  const player = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
                  if (!player) return false;
                  return allPicks.filter((p) => p.player_id === player.id).length >= props.length;
                }).length;
                return (
                  <p className="text-[11px] text-[#71717a] pt-1">
                    {joinedCount}/{EXPECTED_PLAYERS.length} joined &middot; {doneCount}/{EXPECTED_PLAYERS.length} done picking
                  </p>
                );
              })()}
            </div>

            {/* Pre-Game Validation Checklist */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-[#e4e4e7]">Pre-Game Validation</h2>
              <div className="space-y-2">
                <CheckItem
                  ok={props.length === 21}
                  label="21 props seeded with valid options"
                  detail={`${props.length}/21 props. ${props.filter((p) => !p.options || p.options.length < 2).length} with missing options.`}
                />
                <CheckItem
                  ok={missingPlayers.length === 0}
                  label="All 10 players have accounts"
                  detail={
                    missingPlayers.length > 0
                      ? `Missing: ${missingPlayers.join(", ")}`
                      : `All ${EXPECTED_PLAYERS.length} players joined`
                  }
                />
                <CheckItem
                  ok={!!process.env.NEXT_PUBLIC_LOCK_TIME && new Date(process.env.NEXT_PUBLIC_LOCK_TIME) > new Date()}
                  label="Lock time is set and in the future"
                  detail={process.env.NEXT_PUBLIC_LOCK_TIME || "Not set"}
                />
                <CheckItem
                  ok={gameState?.status === "pre"}
                  label='Game state is "pre"'
                  detail={`Current: ${gameState?.status || "unknown"}`}
                />
                <CheckItem
                  ok={!!gameState}
                  label="Supabase is reachable"
                  detail={gameState ? "Connected" : "No game_state found"}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handleSeedCurated}
                className="py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm"
              >
                Seed Curated Props (21)
              </button>
              <button
                onClick={handleSeedOddsApi}
                className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm"
              >
                Seed from Odds API
              </button>
              <button
                onClick={handlePoll}
                className="py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-sm"
              >
                Poll ESPN Now
              </button>
            </div>
            {seedStatus && <p className="text-[11px] text-[#71717a]">{seedStatus}</p>}
            {pollStatus && <p className="text-[11px] text-[#71717a] break-all">{pollStatus}</p>}
          </>
        )}

        {/* ========== PLAYER MANAGEMENT ========== */}
        {activeSection === "players" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#71717a] uppercase">Player Management</h2>
              <span className="text-[11px] text-[#71717a]">
                {players.length}/{EXPECTED_PLAYERS.length} players joined
                {missingPlayers.length > 0 && (
                  <span className="text-red-400 ml-1">
                    Missing: {missingPlayers.join(", ")}
                  </span>
                )}
              </span>
            </div>

            {/* Player table */}
            <div className="border border-[#27272a] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f0f13] border-b border-[#27272a]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#71717a] uppercase">Name</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-medium text-[#71717a] uppercase">Picks</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-medium text-[#71717a] uppercase">Points</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-medium text-[#71717a] uppercase">Rank</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-[#71717a] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const picksForPlayer = allPicks.filter((pick) => pick.player_id === p.id);
                    return (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        picksCount={picksForPlayer.length}
                        isExpanded={expandedPlayer === p.id}
                        playerPicks={expandedPlayer === p.id ? playerPicks : []}
                        playerPicksLoading={expandedPlayer === p.id && playerPicksLoading}
                        onViewPicks={() => handleViewPicks(p.id)}
                        onResetPicks={() => handleResetPicks(p.id, p.name)}
                        onDeletePlayer={() => handleDeletePlayer(p.id, p.name)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Account Switch Detection */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Account Switch Detection</h3>
              <p className="text-[11px] text-[#71717a]">
                Device cookie tracking is client-side only. If a player&apos;s browser cookie has been associated with multiple names,
                it will be flagged here at game time. Currently informational only -- not blocking.
              </p>
              <div className="text-[11px] text-[#71717a] italic">
                No anomalies detected (checked at page load).
              </div>
            </div>
          </div>
        )}

        {/* ========== GAME CONTROL ========== */}
        {activeSection === "game" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[#71717a] uppercase">Game Control</h2>

            {/* Current State */}
            {gameState && (
              <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-[#e4e4e7]">Current Game State</h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-[#16161c] rounded-lg p-2">
                    <div className="text-lg font-bold text-white">{gameState.status}</div>
                    <div className="text-[11px] text-[#71717a]">Status</div>
                  </div>
                  <div className="bg-[#16161c] rounded-lg p-2">
                    <div className="text-lg font-bold text-white">
                      {gameState.away_score} - {gameState.home_score}
                    </div>
                    <div className="text-[11px] text-[#71717a]">Score</div>
                  </div>
                  <div className="bg-[#16161c] rounded-lg p-2">
                    <div className="text-lg font-bold text-white">Q{gameState.quarter}</div>
                    <div className="text-[11px] text-[#71717a]">Quarter</div>
                  </div>
                  <div className="bg-[#16161c] rounded-lg p-2">
                    <div className="text-lg font-bold text-white">{gameState.clock}</div>
                    <div className="text-[11px] text-[#71717a]">Clock</div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Buttons */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Set Game Status</h3>
              <div className="grid grid-cols-4 gap-2">
                {["pre", "in_progress", "halftime", "final"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSetStatus(s)}
                    className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${
                      gameState?.status === s
                        ? "bg-green-500 text-[#09090b]"
                        : "bg-[#16161c] text-[#e4e4e7] hover:bg-[#27272a]"
                    }`}
                  >
                    {s.replace("_", " ").toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Lock Time Controls */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Lock Time</h3>
              <p className="text-[11px] text-[#71717a]">
                Current: {process.env.NEXT_PUBLIC_LOCK_TIME || "Not set"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleLockExtend}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[11px]"
                >
                  Extend 15min
                </button>
                <button
                  onClick={handleForceLock}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[11px]"
                >
                  Lock Now
                </button>
              </div>
            </div>

            {/* Force Recalculate */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Score Management</h3>
              <button
                onClick={handleRecalculate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-sm"
              >
                Force Recalculate All Scores
              </button>
            </div>

            {/* Mock Game */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Mock Game Simulation</h3>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-[#71717a]">Step:</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={mockStep}
                  onChange={(e) => setMockStep(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-[#0f0f13] border border-[#27272a] rounded-lg text-sm text-white"
                />
                <button
                  onClick={handleMockStep}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-sm"
                >
                  Run Step {mockStep}
                </button>
              </div>
            </div>

            {gameControlStatus && (
              <p className="text-[11px] text-[#71717a] break-all">{gameControlStatus}</p>
            )}
          </div>
        )}

        {/* ========== PROPS ========== */}
        {activeSection === "props" && (
          <div className="space-y-4">
            {/* Add Custom Prop */}
            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-[#e4e4e7]">Add Custom Prop</h2>
              <input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Question (e.g., Gatorade Bath Color)"
                className="w-full px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg text-sm text-white"
              />
              <div className="flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as "game" | "player" | "fun" | "degen")}
                  className="px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg text-sm text-white"
                >
                  <option value="fun">Fun</option>
                  <option value="game">Game</option>
                  <option value="player">Player</option>
                  <option value="degen">Degen</option>
                </select>
                <select
                  value={newPropType}
                  onChange={(e) => setNewPropType(e.target.value as "binary" | "over_under" | "multi_choice")}
                  className="px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg text-sm text-white"
                >
                  <option value="binary">Binary (Yes/No)</option>
                  <option value="over_under">Over/Under</option>
                  <option value="multi_choice">Multi Choice</option>
                </select>
              </div>
              {newOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt.label}
                    onChange={(e) => {
                      const updated = [...newOptions];
                      updated[i] = { ...updated[i], label: e.target.value };
                      setNewOptions(updated);
                    }}
                    placeholder={`Option ${i + 1} label`}
                    className="flex-1 px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg text-sm text-white"
                  />
                  <input
                    type="number"
                    value={opt.odds}
                    onChange={(e) => {
                      const updated = [...newOptions];
                      updated[i] = { ...updated[i], odds: Number(e.target.value) };
                      setNewOptions(updated);
                    }}
                    placeholder="Odds"
                    className="w-24 px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg text-sm text-white"
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  onClick={() => setNewOptions([...newOptions, { label: "", odds: 100, value: "" }])}
                  className="text-[11px] text-green-500 hover:text-green-400"
                >
                  + Add Option
                </button>
                <button
                  onClick={handleAddProp}
                  className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm"
                >
                  Add Prop
                </button>
              </div>
            </div>

            {/* Props list */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-[#71717a] uppercase">
                All Props ({props.length})
              </h2>
              {props.map((prop) => (
                <div
                  key={prop.id}
                  className={`border rounded-xl p-4 space-y-2 ${
                    prop.status === "resolved"
                      ? "border-green-800/30 bg-green-950/20"
                      : "border-[#27272a] bg-[#0f0f13]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {prop.name && (
                        <span className="text-[11px] text-green-500 font-bold block">{prop.name}</span>
                      )}
                      <span className="text-sm font-semibold text-white">{prop.question}</span>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[11px] bg-[#16161c] text-[#71717a] px-2 py-0.5 rounded">
                          {prop.category}
                        </span>
                        <span className="text-[11px] bg-[#16161c] text-[#71717a] px-2 py-0.5 rounded">
                          {prop.prop_type}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded ${
                            prop.status === "resolved"
                              ? "bg-green-900/50 text-green-500"
                              : prop.status === "in_progress"
                              ? "bg-blue-900/50 text-blue-400"
                              : "bg-[#16161c] text-[#71717a]"
                          }`}
                        >
                          {prop.status}
                        </span>
                      </div>
                      {prop.resolution_criteria && (
                        <p className="text-[11px] text-[#71717a]/60 mt-1 line-clamp-2">
                          {prop.resolution_criteria}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {prop.current_value !== null && prop.threshold !== null && (
                        <span className="text-[11px] text-[#71717a]">
                          {prop.current_value}/{prop.threshold}
                        </span>
                      )}
                      {prop.status === "resolved" && (
                        <button
                          onClick={() => handleUndoResolve(prop.id, prop.name || prop.question)}
                          className="text-[11px] text-orange-400 hover:text-orange-300 px-2 py-1 border border-orange-800/30 rounded"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {prop.options.map((opt) => {
                      const isResult = prop.result === opt.value;
                      const pickCount = allPicks.filter(
                        (p) => p.prop_id === prop.id && p.selection === opt.value
                      ).length;

                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            if (prop.status !== "resolved") {
                              handleResolve(prop.id, opt.value, prop.name || prop.question);
                            }
                          }}
                          disabled={prop.status === "resolved"}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            isResult
                              ? "bg-green-500 text-[#09090b] font-bold"
                              : "bg-[#16161c] text-[#e4e4e7] hover:bg-[#27272a]"
                          } ${prop.status === "resolved" ? "cursor-default" : "cursor-pointer"}`}
                        >
                          {opt.label} ({formatOdds(opt.odds)}) {formatPoints(oddsToPoints(opt.odds))}pts
                          <span className="ml-1 text-[#71717a]">[{pickCount}]</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== HEALTH ========== */}
        {activeSection === "health" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#71717a] uppercase">System Health</h2>
              <button
                onClick={runHealthCheck}
                disabled={healthLoading}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-[11px] disabled:opacity-50"
              >
                {healthLoading ? "Checking..." : "Run Health Check"}
              </button>
            </div>

            {Object.keys(healthStatus).length > 0 && (
              <div className="border border-[#27272a] rounded-xl overflow-hidden">
                {Object.entries(healthStatus).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          val.ok ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-white capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#71717a] max-w-[60%] text-right">
                      {val.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(healthStatus).length === 0 && (
              <p className="text-[11px] text-[#71717a]">Click &quot;Run Health Check&quot; to test system components.</p>
            )}
          </div>
        )}

        {/* ========== BACKUP ========== */}
        {activeSection === "backup" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[#71717a] uppercase">Backup &amp; Export</h2>

            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Export Data</h3>
              <button
                onClick={handleExportJson}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm"
              >
                Export JSON
              </button>
              <p className="text-[11px] text-[#71717a]">
                Downloads all picks, props, and player data as a JSON file.
              </p>
              {typeof window !== "undefined" && localStorage.getItem("shermbowl_last_backup") && (
                <p className="text-[11px] text-[#71717a]">
                  Last backup: {new Date(localStorage.getItem("shermbowl_last_backup")!).toLocaleString()}
                </p>
              )}
            </div>

            <div className="border border-[#27272a] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#e4e4e7]">Google Sheet Backup</h3>
              <a
                href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "17NcpJsQyTTZXxzOpse1mJhcGMi2tldP39WtQ9vxnQa4"}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-500 hover:text-green-400 underline"
              >
                View Backup Sheet
              </a>
              <p className="text-[11px] text-[#71717a]">
                Use the /api/backup-picks endpoint to sync data to the Google Sheet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function CheckItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center text-[11px] font-bold ${
        ok ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
      }`}>
        {ok ? "\u2713" : "\u2717"}
      </div>
      <div>
        <span className="text-sm text-white">{label}</span>
        <p className="text-[11px] text-[#71717a]">{detail}</p>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  picksCount,
  isExpanded,
  playerPicks,
  playerPicksLoading,
  onViewPicks,
  onResetPicks,
  onDeletePlayer,
}: {
  player: Player;
  picksCount: number;
  isExpanded: boolean;
  playerPicks: Record<string, unknown>[];
  playerPicksLoading: boolean;
  onViewPicks: () => void;
  onResetPicks: () => void;
  onDeletePlayer: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#27272a] hover:bg-[#16161c]/50">
        <td className="px-4 py-3">
          <span className="text-sm font-semibold text-white">{player.name}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm text-[#e4e4e7]">{picksCount}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm font-bold text-green-500">{formatPoints(player.total_points)}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm text-[#71717a]">#{player.rank}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onViewPicks}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                isExpanded
                  ? "bg-green-500 text-[#09090b]"
                  : "bg-[#16161c] text-[#71717a] hover:text-[#e4e4e7]"
              }`}
            >
              {isExpanded ? "Hide" : "View"}
            </button>
            <button
              onClick={onResetPicks}
              className="px-2 py-1 rounded text-[11px] font-medium bg-[#16161c] text-amber-400 hover:bg-amber-500/20"
            >
              Reset
            </button>
            <button
              onClick={onDeletePlayer}
              className="px-2 py-1 rounded text-[11px] font-medium bg-[#16161c] text-red-400 hover:bg-red-500/20"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="px-4 py-3 bg-[#0f0f13]">
            {playerPicksLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-[#71717a]">Loading picks...</span>
              </div>
            ) : playerPicks.length === 0 ? (
              <p className="text-[11px] text-[#71717a]">No picks found.</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {playerPicks.map((pick, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 px-2 rounded bg-[#16161c]/50"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-[#71717a] mr-2">#{i + 1}</span>
                      <span className="text-[11px] text-white truncate">
                        {pick.question as string}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <span className="text-[11px] font-medium text-green-500">
                        {pick.selection_label as string}
                      </span>
                      <span className="text-[11px] text-[#71717a]">
                        {formatPoints(pick.point_value as number)}pts
                      </span>
                      {pick.is_correct !== null && (
                        <span
                          className={`text-[11px] font-bold ${
                            pick.is_correct ? "text-green-500" : "text-red-400"
                          }`}
                        >
                          {pick.is_correct ? "\u2713" : "\u2717"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
