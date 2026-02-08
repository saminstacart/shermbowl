"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import CountdownTimer from "@/components/CountdownTimer";
import RulesModal from "@/components/RulesModal";
import type { Player, Prop, Pick } from "@/lib/types";
import { oddsToPoints, formatPoints, formatOdds } from "@/lib/types";

export default function WaitingPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [myPicks, setMyPicks] = useState<Pick[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showMyPicks, setShowMyPicks] = useState(false);
  const [showGroupPicks, setShowGroupPicks] = useState(false);
  const router = useRouter();

  const kickoffTime = process.env.NEXT_PUBLIC_KICKOFF_TIME || "";
  const lockTime = process.env.NEXT_PUBLIC_LOCK_TIME || "";
  const isLocked = lockTime ? new Date() > new Date(lockTime) : false;

  useEffect(() => {
    const pid = Cookies.get("shermbowl_player_id");
    const pname = Cookies.get("shermbowl_player_name");
    if (!pid || !pname) {
      router.push("/");
      return;
    }
    setPlayerName(pname);
    setPlayerId(pid);
  }, [router]);

  // Fetch players
  useEffect(() => {
    const fetchPlayers = () => {
      fetch("/api/players")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setPlayers(data);
        })
        .catch(() => {});
    };

    fetchPlayers();
    const interval = setInterval(fetchPlayers, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch my picks, props, and all picks
  useEffect(() => {
    if (!playerId) return;

    import("@/lib/supabase").then(({ supabase }) => {
      supabase
        .from("picks")
        .select("*")
        .eq("player_id", playerId)
        .then(({ data }) => {
          if (data) setMyPicks(data as Pick[]);
        });

      supabase
        .from("props")
        .select("*")
        .order("sort_order", { ascending: true })
        .then(({ data }) => {
          if (data) setProps(data as Prop[]);
        });

      // Fetch all picks for group distribution (only after lock)
      if (isLocked) {
        supabase
          .from("picks")
          .select("*")
          .then(({ data }) => {
            if (data) setAllPicks(data as Pick[]);
          });
      }
    });
  }, [playerId, isLocked]);

  // Check if game has started
  useEffect(() => {
    const check = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase
          .from("game_state")
          .select("status")
          .eq("id", 1)
          .single();

        if (data && data.status !== "pre") {
          router.push("/live");
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [router]);

  const lockedPlayers = players.filter((p) => p.picks_count > 0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Picks Locked</h1>
          <p className="text-sm text-[#71717a]">{playerName}&apos;s picks are in</p>
        </div>

        {/* Countdown to kickoff */}
        {kickoffTime && (
          <div className="py-6">
            <p className="text-[11px] text-[#71717a] text-center mb-2 uppercase tracking-[0.15em] font-bold">Kickoff in</p>
            <CountdownTimer targetTime={kickoffTime} />
          </div>
        )}

        {/* Picks revealed message */}
        <div className="text-center px-4 py-3 rounded-xl bg-[#0f0f13] border border-[#27272a]">
          <p className="text-[11px] text-[#71717a]">
            Picks will be revealed at kickoff. All picks are hidden until then.
          </p>
        </div>

        {/* Players list */}
        <div>
          <p className="text-[11px] text-[#71717a] text-center mb-3 font-bold uppercase tracking-wider">
            {lockedPlayers.length} player{lockedPlayers.length !== 1 ? "s" : ""} locked in
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <div
                key={p.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  p.name === playerName
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : p.picks_count > 0
                    ? "bg-[#16161c] text-[#e4e4e7] border border-[#27272a]"
                    : "bg-[#0f0f13] text-[#71717a] border border-[#27272a]"
                }`}
              >
                {p.name}
                {p.picks_count > 0 && (
                  <span className="ml-1 text-[#71717a]">({p.picks_count})</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Your picks (hidden from others) */}
        {myPicks.length > 0 && (
          <div>
            <button
              onClick={() => setShowMyPicks(!showMyPicks)}
              className="w-full text-[11px] text-[#71717a] hover:text-[#e4e4e7] text-center py-2 transition-colors"
            >
              {showMyPicks ? "Hide your picks" : "View your picks (hidden from others)"}
            </button>
            {showMyPicks && (
              <div className="space-y-1.5 mt-2">
                {props.map((prop) => {
                  const pick = myPicks.find((p) => p.prop_id === prop.id);
                  if (!pick) return null;
                  const option = prop.options.find(
                    (o) => o.value === pick.selection
                  );
                  if (!option) return null;
                  return (
                    <div
                      key={prop.id}
                      className="flex items-center justify-between px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg"
                    >
                      <span className="text-xs text-[#71717a] truncate flex-1">
                        {prop.name || prop.question}
                      </span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#e4e4e7] font-medium">
                          {option.label}
                        </span>
                        <span className="text-[11px] text-green-500 font-mono">
                          {formatPoints(oddsToPoints(option.odds))}pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Group Picks Distribution (after lock) */}
        {isLocked && allPicks.length > 0 && props.length > 0 && (
          <div>
            <button
              onClick={() => setShowGroupPicks(!showGroupPicks)}
              className="w-full text-[11px] text-[#71717a] hover:text-[#e4e4e7] text-center py-2 transition-colors"
            >
              {showGroupPicks ? "Hide group picks" : "View Group Picks"}
            </button>
            {showGroupPicks && (
              <div className="space-y-3 mt-2">
                {props.map((prop) => {
                  const picksForProp = allPicks.filter((p) => p.prop_id === prop.id);
                  if (picksForProp.length === 0) return null;

                  const counts: Record<string, number> = {};
                  for (const pick of picksForProp) {
                    counts[pick.selection] = (counts[pick.selection] || 0) + 1;
                  }
                  const total = picksForProp.length;
                  const colors = ["bg-green-500", "bg-blue-400", "bg-amber-400", "bg-red-400", "bg-purple-400"];

                  return (
                    <div key={prop.id} className="px-3 py-2 bg-[#0f0f13] border border-[#27272a] rounded-lg">
                      <p className="text-xs text-[#e4e4e7] mb-1.5 truncate">{prop.name || prop.question}</p>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-[#27272a]">
                        {prop.options.map((opt, i) => {
                          const count = counts[opt.value] || 0;
                          const pct = total > 0 ? (count / total) * 100 : 0;
                          if (pct === 0) return null;
                          return (
                            <div
                              key={opt.value}
                              className={`${colors[i % colors.length]} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        {prop.options.map((opt) => {
                          const count = counts[opt.value] || 0;
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <span key={opt.value} className="text-[11px] text-[#71717a]">
                              {opt.label} {pct}%
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-[#71717a] text-center">
          Live tracking starts at kickoff
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setShowRules(true)}
            className="flex-1 py-3 bg-[#0f0f13] hover:bg-[#16161c] text-[#71717a] font-medium rounded-xl transition-colors text-sm border border-[#27272a]"
          >
            Rules
          </button>
          <button
            onClick={() => router.push("/live")}
            className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-[#09090b] font-bold rounded-xl transition-colors text-sm"
          >
            Live Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
