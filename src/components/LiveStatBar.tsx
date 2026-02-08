"use client";
import { motion } from "framer-motion";
import type { Prop } from "@/lib/types";
import { oddsToPoints, formatPoints } from "@/lib/types";

interface LiveStatBarProps {
  prop: Prop;
  selection?: string | null;
}

export default function LiveStatBar({ prop, selection }: LiveStatBarProps) {
  if (prop.status !== "in_progress") return null;

  // Over/Under props — progress bar toward threshold
  if (
    prop.prop_type === "over_under" &&
    prop.current_value !== null &&
    prop.threshold !== null
  ) {
    return <OverUnderBar prop={prop} selection={selection} />;
  }

  // Binary matchup props with live_stats — two-bar comparison
  if (prop.prop_type === "binary" && prop.live_stats) {
    return <BinaryMatchupBar prop={prop} selection={selection} />;
  }

  // Multi-choice with live_stats — ranked list
  if (prop.prop_type === "multi_choice" && prop.live_stats) {
    return <MultiChoiceBar prop={prop} selection={selection} />;
  }

  return null;
}

function OverUnderBar({
  prop,
  selection,
}: {
  prop: Prop;
  selection?: string | null;
}) {
  const current = prop.current_value!;
  const threshold = prop.threshold!;
  const pct = Math.min((current / threshold) * 100, 150);
  const isOver = current > threshold;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#71717a]">
          Current: <span className="text-white font-bold">{current}</span> / {threshold}
        </span>
        <span className={isOver ? "text-green-500 font-bold" : "text-orange-400 font-bold"}>
          Trending {isOver ? "OVER" : "UNDER"}
        </span>
      </div>
      <div className="relative h-2 bg-[#27272a] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isOver ? "bg-green-500" : "bg-orange-400"}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/30"
          style={{ left: `${Math.min(100, (threshold / (threshold * 1.5)) * 100)}%` }}
        />
      </div>
      {selection && (
        <div className="text-[11px] text-[#71717a]">
          Your pick: <span className={selection === "over" && isOver || selection === "under" && !isOver ? "text-green-500" : "text-orange-400"}>
            {selection === "over" ? "Over" : "Under"}
          </span>
          {" "}({formatPoints(oddsToPoints(prop.options.find((o) => o.value === selection)?.odds || 0))} pts)
        </div>
      )}
    </div>
  );
}

function BinaryMatchupBar({
  prop,
  selection,
}: {
  prop: Prop;
  selection?: string | null;
}) {
  const stats = prop.live_stats as Record<string, number>;
  if (!stats || Object.keys(stats).length < 2) return null;

  const entries = prop.options.map((opt) => ({
    label: opt.label,
    value: opt.value,
    stat: stats[opt.value] || 0,
    pts: oddsToPoints(opt.odds),
  }));

  const maxStat = Math.max(...entries.map((e) => e.stat), 1);

  return (
    <div className="mt-3 space-y-2">
      {entries.map((entry) => {
        const isWinning = entry.stat === Math.max(...entries.map((e) => e.stat));
        const isPicked = selection === entry.value;
        return (
          <div key={entry.value} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className={`${isWinning ? "text-green-500 font-semibold" : "text-[#71717a]"}`}>
                {entry.label}
                {isPicked && <span className="text-[11px] text-[#71717a]/60 ml-1">(your pick)</span>}
              </span>
              <span className={`font-mono ${isWinning ? "text-white font-bold" : "text-[#71717a]"}`}>
                {entry.stat}
              </span>
            </div>
            <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isWinning ? "bg-green-500" : "bg-[#71717a]/40"}`}
                initial={{ width: 0 }}
                animate={{ width: `${(entry.stat / maxStat) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MultiChoiceBar({
  prop,
  selection,
}: {
  prop: Prop;
  selection?: string | null;
}) {
  const stats = prop.live_stats as Record<string, number>;
  if (!stats) return null;

  const entries = prop.options
    .map((opt) => ({
      label: opt.label,
      value: opt.value,
      stat: stats[opt.value] || 0,
      pts: oddsToPoints(opt.odds),
    }))
    .sort((a, b) => b.stat - a.stat);

  const leader = entries[0]?.stat || 0;

  return (
    <div className="mt-3 space-y-1">
      {entries.slice(0, 5).map((entry, i) => {
        const isLeader = i === 0 && leader > 0;
        const isPicked = selection === entry.value;
        return (
          <div
            key={entry.value}
            className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
              isPicked ? "bg-green-500/10" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[#71717a]/60 w-4">{i + 1}.</span>
              <span className={isLeader ? "text-green-500 font-semibold" : "text-[#71717a]"}>
                {entry.label}
              </span>
              {isPicked && <span className="text-[11px] text-green-500/60">★</span>}
            </div>
            <span className={`font-mono ${isLeader ? "text-white font-bold" : "text-[#71717a]"}`}>
              {entry.stat}
            </span>
          </div>
        );
      })}
    </div>
  );
}
