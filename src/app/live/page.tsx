"use client";
import { useState, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import ScoreBar from "@/components/ScoreBar";
import TabNav from "@/components/TabNav";
import ProjectedLeaderboard from "@/components/ProjectedLeaderboard";
import PropCard from "@/components/PropCard";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import RulesModal from "@/components/RulesModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useRealtimeProps } from "@/hooks/useRealtimeProps";
import { useGameState } from "@/hooks/useGameState";
import { supabase } from "@/lib/supabase";
import { formatPoints, oddsToPoints } from "@/lib/types";
import type { Pick, Prop } from "@/lib/types";

export default function LivePage() {
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [myPicks, setMyPicks] = useState<Pick[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const { props, loading: propsLoading, connected: realtimeConnected } = useRealtimeProps();
  const game = useGameState();
  const prevResolvedRef = useRef<number>(0);
  const router = useRouter();

  const lockTime = process.env.NEXT_PUBLIC_LOCK_TIME || "";
  const isLocked = lockTime ? new Date() > new Date(lockTime) : false;

  useEffect(() => {
    const pid = Cookies.get("shermbowl_player_id");
    const pname = Cookies.get("shermbowl_player_name");
    if (!pid || !pname) {
      router.push("/");
      return;
    }
    setPlayerId(pid);
    setPlayerName(pname);
  }, [router]);

  useEffect(() => {
    if (!playerId) return;

    const fetchPicks = async () => {
      const { data } = await supabase
        .from("picks")
        .select("*")
        .eq("player_id", playerId);
      if (data) setMyPicks(data as Pick[]);
    };

    fetchPicks();

    const channel = supabase
      .channel("my_picks_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "picks",
          filter: `player_id=eq.${playerId}`,
        },
        () => fetchPicks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  // Fetch all picks for group distribution (only after lock)
  useEffect(() => {
    if (!isLocked) return;

    const fetchAllPicks = async () => {
      const { data } = await supabase
        .from("picks")
        .select("*");
      if (data) {
        setAllPicks(data as Pick[]);
        setLastUpdate(new Date());
      }
    };

    fetchAllPicks();

    const channel = supabase
      .channel("all_picks_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "picks",
        },
        () => fetchAllPicks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLocked]);

  useEffect(() => {
    const poll = () => {
      fetch(`/api/poll-game?key=${process.env.NEXT_PUBLIC_ADMIN_SECRET || ""}`).catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const resolvedCount = props.filter((p) => p.status === "resolved").length;
    if (resolvedCount > prevResolvedRef.current && prevResolvedRef.current > 0) {
      setConfettiTrigger((c) => c + 1);
    }
    prevResolvedRef.current = resolvedCount;
  }, [props]);

  // Track last update time when realtime reconnects
  useEffect(() => {
    if (realtimeConnected) {
      setLastUpdate(new Date());
    }
  }, [realtimeConnected]);

  // Compute seconds since last update for disconnected banner
  useEffect(() => {
    if (realtimeConnected) return;
    const interval = setInterval(() => {
      setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [realtimeConnected, lastUpdate]);

  const selectionMap = new Map(myPicks.map((p) => [p.prop_id, p.selection]));

  const resolvedProps = props.filter((p) => p.status === "resolved");
  const inProgressProps = props.filter((p) => p.status === "in_progress");
  const pendingProps = props.filter((p) => p.status === "pending");

  const myCorrect = myPicks.filter((p) => p.is_correct === true).length;
  const myPoints = myPicks.reduce((sum, p) => sum + (p.points_earned || 0), 0);
  const myInitialCeiling = myPicks.reduce((sum, pick) => {
    const prop = props.find((p) => p.id === pick.prop_id);
    if (!prop) return sum;
    const opt = prop.options.find((o) => o.value === pick.selection);
    if (!opt) return sum;
    return sum + oddsToPoints(opt.odds);
  }, 0);
  const myMaxPossible = myPicks.reduce((sum, pick) => {
    const prop = props.find((p) => p.id === pick.prop_id);
    if (!prop) return sum;
    const opt = prop.options.find((o) => o.value === pick.selection);
    if (!opt) return sum;
    const pv = oddsToPoints(opt.odds);
    if (prop.status === "resolved") {
      return sum + (pick.is_correct ? pv : 0);
    }
    return sum + pv;
  }, 0);
  const myLostPoints = myInitialCeiling - myMaxPossible;
  const myInPlay = myMaxPossible - myPoints;

  return (
    <div className="min-h-screen pb-16">
      <ConfettiOverlay trigger={confettiTrigger} />
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
      <ScoreBar />

      {/* Reconnecting banner */}
      {!realtimeConnected && (
        <div className="bg-amber-900/30 text-amber-200/80 text-center text-[11px] font-bold px-4 py-1.5 flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 border-2 border-amber-300/50 border-t-transparent rounded-full animate-spin" />
          Reconnecting... Data may be up to {secondsSinceUpdate}s old
        </div>
      )}

      {/* Rules button */}
      <div className="max-w-lg mx-auto px-5 pt-2 flex justify-end">
        <button
          onClick={() => setShowRules(true)}
          className="text-[11px] text-[#71717a] hover:text-green-500 transition-colors px-2 py-0.5 rounded border border-[#27272a] hover:border-green-500/20"
        >
          Rules
        </button>
      </div>

      <ErrorBoundary fallbackMessage="The live view hit an error. Reload to get back in the game.">
        <div className="max-w-lg mx-auto px-5 py-4">
          {activeTab === "leaderboard" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.15em]">
                  Leaderboard
                </h2>
                <span className="text-[11px] text-[#71717a] font-mono">
                  {resolvedProps.length}/{props.length} resolved
                </span>
              </div>
              <ProjectedLeaderboard currentPlayerId={playerId} props={props} isLocked={isLocked} />
            </div>
          )}

          {activeTab === "props" && (
            <div className="space-y-6">
              {resolvedProps.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-bold text-green-500/70 uppercase tracking-[0.15em] mb-3">
                    Resolved ({resolvedProps.length})
                  </h2>
                  <div className="space-y-2.5">
                    {resolvedProps.map((prop) => (
                      <div key={prop.id}>
                        <PropCard
                          prop={prop}
                          selection={selectionMap.get(prop.id) || null}
                          onSelect={() => {}}
                          locked
                          showResult
                        />
                        {isLocked && <PickDistribution prop={prop} allPicks={allPicks} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inProgressProps.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-bold text-red-400/70 uppercase tracking-[0.15em] mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-ring inline-block" />
                    Live ({inProgressProps.length})
                  </h2>
                  <div className="space-y-2.5">
                    {inProgressProps.map((prop) => (
                      <div key={prop.id}>
                        <PropCard
                          prop={prop}
                          selection={selectionMap.get(prop.id) || null}
                          onSelect={() => {}}
                          locked
                          showResult={false}
                        />
                        {isLocked && <PickDistribution prop={prop} allPicks={allPicks} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingProps.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-bold text-[#71717a] uppercase tracking-[0.15em] mb-3">
                    Pending ({pendingProps.length})
                  </h2>
                  <div className="space-y-2.5">
                    {pendingProps.map((prop) => (
                      <div key={prop.id}>
                        <PropCard
                          prop={prop}
                          selection={selectionMap.get(prop.id) || null}
                          onSelect={() => {}}
                          locked
                        />
                        {isLocked && <PickDistribution prop={prop} allPicks={allPicks} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {propsLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {activeTab === "me" && (
            <div className="space-y-4">
              <div className="text-center py-3 space-y-1">
                <h2 className="text-base font-bold text-white">{playerName}</h2>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div>
                    <span className="text-green-500 font-bold font-mono">
                      {formatPoints(myPoints)}
                    </span>{" "}
                    <span className="text-[#71717a] text-xs">pts</span>
                  </div>
                  <div className="w-px h-4 bg-[#27272a]" />
                  <div>
                    <span className="text-white font-bold">{myCorrect}</span>
                    <span className="text-[#71717a] text-xs">
                      /{resolvedProps.length} correct
                    </span>
                  </div>
                </div>
              </div>

              {/* Scoring breakdown card */}
              {myInitialCeiling > 0 && (
                <div className="rounded-xl border border-[#27272a] bg-[#0f0f13] p-3 space-y-2.5">
                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden bg-[#1a1a1f]">
                    {myPoints > 0 && (
                      <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${(myPoints / myInitialCeiling) * 100}%` }}
                      />
                    )}
                    {myInPlay > 0 && (
                      <div
                        className="bg-amber-500/80 transition-all"
                        style={{ width: `${(myInPlay / myInitialCeiling) * 100}%` }}
                      />
                    )}
                    {myLostPoints > 0 && (
                      <div
                        className="bg-red-500/20 transition-all"
                        style={{ width: `${(myLostPoints / myInitialCeiling) * 100}%` }}
                      />
                    )}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-green-500">Won {formatPoints(myPoints)}</span>
                    <span className="text-amber-500/80">In play {formatPoints(myInPlay)}</span>
                    <span className="text-red-400/50">Lost {formatPoints(myLostPoints)}</span>
                  </div>
                  {/* Fraction */}
                  <div className="text-center text-xs text-[#e4e4e7] font-mono">
                    {formatPoints(myPoints)} / {formatPoints(myInitialCeiling)}
                  </div>
                  {/* Explainer */}
                  <p className="text-[11px] text-[#71717a]/60 text-center italic">
                    Your ceiling depends on the odds you picked &mdash; riskier picks = higher ceiling
                  </p>
                </div>
              )}

              {/* Picks grouped by status: live first, then pending, then resolved */}
              {(() => {
                const grouped = {
                  live: [] as { pick: Pick; prop: Prop }[],
                  pending: [] as { pick: Pick; prop: Prop }[],
                  won: [] as { pick: Pick; prop: Prop }[],
                  lost: [] as { pick: Pick; prop: Prop }[],
                };
                for (const pick of myPicks) {
                  const prop = props.find((p) => p.id === pick.prop_id);
                  if (!prop) continue;
                  if (prop.status === "in_progress") grouped.live.push({ pick, prop });
                  else if (prop.status === "resolved" && pick.is_correct) grouped.won.push({ pick, prop });
                  else if (prop.status === "resolved") grouped.lost.push({ pick, prop });
                  else grouped.pending.push({ pick, prop });
                }

                const sections = [
                  { key: "live", label: "Live", items: grouped.live, color: "text-red-400" },
                  { key: "pending", label: "Pending", items: grouped.pending, color: "text-[#71717a]" },
                  { key: "won", label: "Won", items: grouped.won, color: "text-green-500" },
                  { key: "lost", label: "Lost", items: grouped.lost, color: "text-red-400/50" },
                ].filter((s) => s.items.length > 0);

                if (sections.length === 0) {
                  return (
                    <p className="text-center text-[#71717a] py-8 text-sm">
                      No picks made
                    </p>
                  );
                }

                return sections.map((section) => (
                  <div key={section.key} className="space-y-2">
                    <div className="flex items-center gap-2 pt-2">
                      {section.key === "live" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-ring" />
                      )}
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${section.color}`}>
                        {section.label} ({section.items.length})
                      </span>
                    </div>
                    {section.items.map(({ pick, prop }) => (
                      <MyPickRow key={pick.id} pick={pick} prop={prop} />
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </ErrorBoundary>

      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function PickDistribution({ prop, allPicks }: { prop: Prop; allPicks: Pick[] }) {
  const picksForProp = allPicks.filter((p) => p.prop_id === prop.id);
  if (picksForProp.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const pick of picksForProp) {
    counts[pick.selection] = (counts[pick.selection] || 0) + 1;
  }

  const total = picksForProp.length;
  const colors = ["bg-green-500", "bg-blue-400", "bg-amber-400", "bg-red-400", "bg-purple-400"];

  return (
    <div className="mt-1 mx-1">
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
      <div className="flex justify-between mt-0.5">
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
}

function MyPickRow({ pick, prop }: { pick: Pick; prop: Prop }) {
  const option = prop.options.find((o) => o.value === pick.selection);
  const isResolved = prop.status === "resolved";
  const isInProgress = prop.status === "in_progress";
  const isCorrect = pick.is_correct === true;
  const isWrong = pick.is_correct === false;
  const points = option ? oddsToPoints(option.odds) : 0;

  const borderLeftColor = isCorrect
    ? "border-l-green-500"
    : isWrong
    ? "border-l-red-500"
    : isInProgress
    ? "border-l-amber-500"
    : "border-l-transparent";

  // Determine live status text for in-progress props
  let liveStatus: string | null = null;
  let isTrending = false;
  if (isInProgress) {
    if (prop.live_stats) {
      const stats = prop.live_stats as Record<string, number>;
      // For multi-option props (e.g., first TD, MVP), show current leader
      const selectedStat = stats[pick.selection];
      if (selectedStat !== undefined) {
        const maxStat = Math.max(...Object.values(stats).filter(v => typeof v === "number"));
        isTrending = selectedStat === maxStat && maxStat > 0;
        liveStatus = isTrending ? "Trending" : "Trailing";
      }
    } else if (prop.current_value !== null && prop.threshold !== null) {
      // For over/under props, show current value vs threshold
      const current = prop.current_value;
      const threshold = prop.threshold;
      const isOver = current > threshold;
      const pickedOver = pick.selection === "over";
      isTrending = (pickedOver && isOver) || (!pickedOver && !isOver);
      liveStatus = `${current} / ${threshold}`;
    } else {
      liveStatus = "Live";
    }
  }

  return (
    <div
      className={`p-3 rounded-xl border border-l-2 ${borderLeftColor} ${
        isCorrect
          ? "border-green-500/20 bg-green-500/[0.03]"
          : isWrong
          ? "border-red-500/15 bg-red-500/[0.02]"
          : isInProgress
          ? "border-[#27272a] bg-amber-500/[0.02]"
          : "border-[#27272a] bg-[#0f0f13]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isCorrect && <span className="text-green-500 text-xs">&#10003;</span>}
            {isWrong && <span className="text-red-400 text-xs">&#10007;</span>}
            {isInProgress && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-ring shrink-0" />
            )}
            <span className="text-sm text-white truncate">
              {prop.name || prop.question}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[#71717a]">
              You picked: <span className="text-[#e4e4e7]">{option?.label || pick.selection}</span>
            </span>
          </div>
        </div>
        <div className="text-right ml-2 shrink-0">
          {isCorrect ? (
            <div>
              <span className="text-sm font-bold text-green-500 font-mono">
                +{formatPoints(pick.points_earned || 0)}
              </span>
              <div className="text-[10px] text-green-500/60">Won</div>
            </div>
          ) : isWrong ? (
            <div>
              <span className="text-sm font-bold text-red-400/40 font-mono line-through">
                {formatPoints(points)}
              </span>
              <div className="text-[10px] text-red-400/50">Lost</div>
            </div>
          ) : (
            <div>
              <span className="text-sm font-bold text-[#e4e4e7] font-mono">
                {formatPoints(points)}
              </span>
              <div className="text-[10px] text-[#71717a]">at stake</div>
            </div>
          )}
        </div>
      </div>
      {/* Live tracking row for in-progress props */}
      {isInProgress && liveStatus && (
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#27272a]/30">
          <span className={`text-[11px] font-mono ${isTrending ? "text-green-500" : "text-amber-500/70"}`}>
            {isTrending ? "\u25B2" : "\u25BC"} {liveStatus}
          </span>
          {isResolved ? null : (
            <span className="text-[10px] text-[#71717a]/50">
              {prop.result ? `Result: ${prop.result}` : "Awaiting result"}
            </span>
          )}
        </div>
      )}
      {/* Show what won for resolved props */}
      {isResolved && prop.result && (
        <div className="mt-1.5 pt-1.5 border-t border-[#27272a]/30">
          <span className="text-[10px] text-[#71717a]">
            Result: <span className={isCorrect ? "text-green-500" : "text-red-400/60"}>
              {prop.options.find(o => o.value === prop.result)?.label || prop.result}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
