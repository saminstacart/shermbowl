"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatPoints, oddsToPoints } from "@/lib/types";
import type { Prop, Pick } from "@/lib/types";

interface ProjectedEntry {
  player_id: string;
  name: string;
  confirmed_points: number;
  projected_points: number;
  max_possible: number;
  initial_ceiling: number;
  picks_count: number;
  rank: number;
  prev_rank: number | null;
  rank_change: number;
}

export default function ProjectedLeaderboard({
  currentPlayerId,
  props,
  isLocked,
}: {
  currentPlayerId: string | null;
  props: Prop[];
  isLocked: boolean;
}) {
  const [entries, setEntries] = useState<ProjectedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"projected" | "confirmed">("projected");

  const gameStarted = props.some(
    (p) => p.status === "in_progress" || p.status === "resolved"
  );

  const calculateProjected = useCallback(async () => {
    const { data: players } = await supabase
      .from("players")
      .select("id, name, total_points, max_possible, picks_count");

    // Only fetch all picks if locked (no leaking others' picks before lock)
    const allPicks: Pick[] = [];
    if (isLocked) {
      const { data } = await supabase.from("picks").select("*");
      if (data) allPicks.push(...(data as Pick[]));
    } else if (currentPlayerId) {
      // Before lock, only fetch YOUR picks
      const { data } = await supabase
        .from("picks")
        .select("*")
        .eq("player_id", currentPlayerId);
      if (data) allPicks.push(...(data as Pick[]));
    }

    if (!players) return;

    const propMap = new Map(props.map((p) => [p.id, p]));

    const newEntries: ProjectedEntry[] = players.map((player) => {
      const playerPicks = allPicks.filter((p) => p.player_id === player.id);

      let confirmed = 0;
      let projected = 0;
      let maxPossible = 0;
      let initialCeiling = 0;

      for (const pick of playerPicks) {
        const prop = propMap.get(pick.prop_id);
        if (!prop) continue;

        const option = prop.options.find((o) => o.value === pick.selection);
        if (!option) continue;

        const pointValue = oddsToPoints(option.odds);
        initialCeiling += pointValue;

        if (prop.status === "resolved") {
          if (prop.result === pick.selection) {
            confirmed += pointValue;
            projected += pointValue;
            maxPossible += pointValue;
          }
        } else {
          maxPossible += pointValue;

          if (prop.status === "in_progress" && prop.live_stats) {
            const stats = prop.live_stats as Record<string, number>;
            const currentWinner = getCurrentWinner(prop, stats);
            if (currentWinner === pick.selection) {
              projected += pointValue;
            }
          } else if (
            prop.status === "in_progress" &&
            prop.current_value !== null &&
            prop.threshold !== null
          ) {
            const isOver = prop.current_value > prop.threshold;
            if (
              (pick.selection === "over" && isOver) ||
              (pick.selection === "under" && !isOver)
            ) {
              projected += pointValue;
            }
          }
        }
      }

      return {
        player_id: player.id,
        name: player.name,
        confirmed_points: confirmed,
        projected_points: projected,
        max_possible: maxPossible,
        initial_ceiling: initialCeiling,
        picks_count: player.picks_count || 0,
        rank: 0,
        prev_rank: null,
        rank_change: 0,
      };
    });

    if (isLocked) {
      // After lock: sort by projected/confirmed, tiebreak by max_possible
      const sortKey =
        sortBy === "projected" ? "projected_points" : "confirmed_points";
      newEntries.sort((a, b) => {
        const diff = b[sortKey] - a[sortKey];
        if (diff !== 0) return diff;
        return b.max_possible - a.max_possible;
      });
    } else {
      // Before lock: alphabetical — no pick-derived ordering
      newEntries.sort((a, b) => a.name.localeCompare(b.name));
    }

    setEntries((prev) => {
      const prevRankMap = new Map(prev.map((p) => [p.player_id, p.rank]));
      return newEntries.map((e, i) => {
        const newRank = i + 1;
        const oldRank = prevRankMap.get(e.player_id) ?? newRank;
        return {
          ...e,
          rank: newRank,
          prev_rank: oldRank,
          rank_change: oldRank - newRank,
        };
      });
    });

    setLoading(false);
  }, [props, sortBy, isLocked, currentPlayerId]);

  useEffect(() => {
    calculateProjected();

    const channel = supabase
      .channel("projected_leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => calculateProjected()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "picks" },
        () => calculateProjected()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calculateProjected]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-center text-[#71717a] py-8 text-sm">
        No players yet
      </p>
    );
  }

  const hasInProgress = props.some((p) => p.status === "in_progress");

  // Pre-lock: only show player names + picks status
  if (!isLocked) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 px-3 text-[11px] text-[#71717a] uppercase tracking-wider font-medium">
          <div className="w-7" />
          <div className="flex-1">Player</div>
          <div className="w-16 text-right">Status</div>
        </div>
        {entries.map((entry) => {
          const isCurrentPlayer = entry.player_id === currentPlayerId;
          const totalProps = props.length;
          const done = entry.picks_count >= totalProps;
          return (
            <div
              key={entry.player_id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                isCurrentPlayer
                  ? "border-green-500/20 bg-green-500/[0.04] border-l-2 border-l-green-500"
                  : "border-transparent bg-transparent"
              }`}
            >
              <div className="w-7" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-sm font-semibold truncate ${
                      isCurrentPlayer ? "text-green-400" : "text-[#e4e4e7]"
                    }`}
                  >
                    {entry.name}
                  </span>
                  {isCurrentPlayer && (
                    <span className="text-[11px] text-green-500/60 uppercase font-bold tracking-wider">
                      You
                    </span>
                  )}
                </div>
              </div>
              <div className="w-16 text-right">
                {done ? (
                  <span className="text-[11px] font-bold text-green-500 uppercase">Locked</span>
                ) : entry.picks_count > 0 ? (
                  <span className="text-[11px] font-medium text-amber-400">
                    {entry.picks_count}/{totalProps}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#71717a]">Waiting</span>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-[#71717a]/60 text-center mt-3 italic">
          Leaderboard unlocks at kickoff
        </p>
      </div>
    );
  }

  // Post-lock: full leaderboard
  return (
    <div className="space-y-2">
      {/* Sort toggle */}
      {hasInProgress && (
        <div className="flex gap-1.5 justify-center mb-3">
          <button
            onClick={() => setSortBy("projected")}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
              sortBy === "projected"
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-[#0f0f12] text-[#71717a] border border-[#27272a]"
            }`}
          >
            Projected
          </button>
          <button
            onClick={() => setSortBy("confirmed")}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
              sortBy === "confirmed"
                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                : "bg-[#0f0f12] text-[#71717a] border border-[#27272a]"
            }`}
          >
            Confirmed
          </button>
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 text-[11px] text-[#71717a] uppercase tracking-wider font-medium">
        <div className="w-7" />
        <div className="flex-1">Player</div>
        <div className="w-14 text-right">Pts</div>
        {hasInProgress && <div className="w-14 text-right">Proj</div>}
        <div className="w-12 text-right">Ceil</div>
      </div>

      <AnimatePresence mode="popLayout">
        {entries.map((entry, i) => {
          const isCurrentPlayer = entry.player_id === currentPlayerId;
          const isTop3 = i < 3;

          return (
            <motion.div
              key={entry.player_id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                isCurrentPlayer
                  ? "border-green-500/20 bg-green-500/[0.04] border-l-2 border-l-green-500"
                  : isTop3
                  ? "border-[#27272a] bg-[#0f0f12]"
                  : "border-transparent bg-transparent"
              } ${entry.rank_change > 0 ? "rank-up" : entry.rank_change < 0 ? "rank-down" : ""}`}
            >
              {/* Rank */}
              <div className="w-7 text-center">
                {i === 0 ? (
                  <div className="flex flex-col items-center gap-0 leading-none">
                    <span className="text-[9px]">{"\u{1F451}"}</span>
                    <span className="text-sm font-extrabold text-[#d4a853]">1</span>
                  </div>
                ) : i === 1 ? (
                  <span className="text-sm font-bold text-[#e4e4e7]">2</span>
                ) : i === 2 ? (
                  <span className="text-sm font-bold text-[#71717a]">3</span>
                ) : (
                  <span className="text-xs font-medium text-[#71717a]">
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Name + change */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-sm font-semibold truncate ${
                      isCurrentPlayer
                        ? "text-green-400"
                        : i === 0
                        ? "text-white"
                        : "text-[#e4e4e7]"
                    }`}
                  >
                    {entry.name}
                  </span>
                  {isCurrentPlayer && (
                    <span className="text-[11px] text-green-500/60 uppercase font-bold tracking-wider">
                      You
                    </span>
                  )}
                </div>
                {entry.rank_change !== 0 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-[11px] font-bold ${
                      entry.rank_change > 0
                        ? "text-green-500"
                        : "text-red-400"
                    }`}
                  >
                    {entry.rank_change > 0 ? "\u25B2" : "\u25BC"}
                    {Math.abs(entry.rank_change)}
                  </motion.span>
                )}
              </div>

              {/* Confirmed */}
              <div className="w-14 text-right">
                <motion.span
                  key={entry.confirmed_points}
                  initial={{ scale: 1.3, color: "#22c55e" }}
                  animate={{ scale: 1, color: "#e4e4e7" }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="text-sm font-bold tabular-nums inline-block"
                >
                  {formatPoints(entry.confirmed_points)}
                </motion.span>
              </div>

              {/* Projected */}
              {hasInProgress && (
                <div className="w-14 text-right">
                  <span className="text-sm font-mono text-red-400/80 tabular-nums">
                    {formatPoints(entry.projected_points)}
                  </span>
                </div>
              )}

              {/* Ceiling */}
              <div className="w-12 text-right">
                <span className="text-[11px] text-[#71717a] tabular-nums font-mono">
                  {formatPoints(entry.initial_ceiling)}
                </span>
              </div>
            </div>
            {/* Stacked progress bar */}
            {entry.initial_ceiling > 0 && (
              <div className="mx-3 -mt-1.5 mb-1">
                <div className="flex h-[3px] rounded-full overflow-hidden bg-[#1a1a1f]">
                  {entry.confirmed_points > 0 && (
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${(entry.confirmed_points / entry.initial_ceiling) * 100}%` }}
                    />
                  )}
                  {hasInProgress && entry.projected_points > entry.confirmed_points && (
                    <div
                      className="bg-amber-500 transition-all"
                      style={{ width: `${((entry.projected_points - entry.confirmed_points) / entry.initial_ceiling) * 100}%` }}
                    />
                  )}
                  {(() => {
                    const inPlayWidth = hasInProgress
                      ? entry.max_possible - entry.projected_points
                      : entry.max_possible - entry.confirmed_points;
                    return inPlayWidth > 0 ? (
                      <div
                        className="bg-[#3f3f46] transition-all"
                        style={{ width: `${(inPlayWidth / entry.initial_ceiling) * 100}%` }}
                      />
                    ) : null;
                  })()}
                </div>
              </div>
            )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <p className="text-[11px] text-[#71717a]/60 text-center mt-3 italic">
        Ceiling varies by person &mdash; riskier picks = higher ceiling
      </p>
      <p className="text-[10px] text-[#71717a]/40 text-center mt-1">
        Odds via DraftKings &mdash; locked Feb 8, 2026 pre-kickoff
      </p>
    </div>
  );
}

function getCurrentWinner(
  prop: Prop,
  stats: Record<string, number>
): string | null {
  let maxValue = -1;
  let winner: string | null = null;

  for (const option of prop.options) {
    const stat = stats[option.value] || 0;
    if (stat > maxValue) {
      maxValue = stat;
      winner = option.value;
    }
  }

  return winner;
}
