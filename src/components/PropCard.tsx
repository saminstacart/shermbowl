"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Prop, PropOption } from "@/lib/types";
import { oddsToPoints, formatPoints, formatOdds } from "@/lib/types";
import PickButton from "./PickButton";

interface PropCardProps {
  prop: Prop;
  selection: string | null;
  onSelect: (propId: string, value: string) => void;
  locked: boolean;
  showResult?: boolean;
}

export default function PropCard({
  prop,
  selection,
  onSelect,
  locked,
  showResult,
}: PropCardProps) {
  const [showCriteria, setShowCriteria] = useState(false);

  const isResolved = prop.status === "resolved";
  const isInProgress = prop.status === "in_progress";

  const userPicked = selection !== null;
  const userCorrect = isResolved && selection === prop.result;

  const paceText =
    isInProgress &&
    prop.current_value !== null &&
    prop.threshold !== null
      ? `Current: ${prop.current_value} / ${prop.threshold}`
      : null;

  const progressPct =
    isInProgress && prop.current_value !== null && prop.threshold !== null
      ? Math.min((prop.current_value / prop.threshold) * 100, 150)
      : null;

  const statusBadge = () => {
    if (isResolved) {
      if (userPicked && userCorrect) {
        return (
          <span className="text-[11px] uppercase font-bold px-2.5 py-1 rounded-md bg-green-500/10 text-green-500 tracking-wider">
            Hit
          </span>
        );
      }
      if (userPicked && !userCorrect) {
        return (
          <span className="text-[11px] uppercase font-bold px-2.5 py-1 rounded-md bg-red-400/10 text-red-400 tracking-wider">
            Miss
          </span>
        );
      }
      return (
        <span className="text-[11px] uppercase font-bold px-2.5 py-1 rounded-md bg-[#27272a] text-[#71717a] tracking-wider">
          Final
        </span>
      );
    }
    if (isInProgress) {
      return (
        <span className="text-[11px] uppercase font-bold px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 tracking-wider flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-red-500 pulse-ring" />
          Live
        </span>
      );
    }
    return null;
  };

  const categoryBorderClass = prop.category ? `cat-border-${prop.category}` : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-colors card-shadow ${categoryBorderClass} ${
        isResolved && userCorrect
          ? "border-green-500/20 bg-green-500/[0.03] shadow-[0_0_8px_rgba(34,197,94,0.12)] celebrate-correct"
          : isResolved && userPicked && !userCorrect
          ? "border-red-500/15 bg-red-500/[0.02] shadow-[0_0_8px_rgba(239,68,68,0.1)]"
          : isResolved
          ? "border-[#1e1e24] bg-[#0f0f12]"
          : isInProgress
          ? "border-red-500/10 bg-[#0f0f12]"
          : "border-[#27272a] bg-[#0f0f12]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {prop.name ? (
            <>
              <h3 className="text-sm font-bold text-white leading-snug">{prop.name}</h3>
              <p className="text-xs text-[#71717a] mt-0.5 leading-snug">{prop.question}</p>
            </>
          ) : (
            <h3 className="text-sm font-semibold text-white leading-snug">{prop.question}</h3>
          )}
        </div>
        <div className="ml-3 shrink-0">{statusBadge()}</div>
      </div>

      {/* Resolution criteria */}
      {prop.resolution_criteria && (
        <div className="mb-3">
          <button
            onClick={() => setShowCriteria((prev) => !prev)}
            className="text-[11px] text-[#71717a] hover:text-[#e4e4e7] transition-colors flex items-center gap-1 uppercase tracking-wider"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform ${showCriteria ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Resolution
          </button>
          <AnimatePresence>
            {showCriteria && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="text-[11px] text-[#71717a] mt-1.5 pl-3 border-l border-[#27272a] leading-relaxed">
                  {prop.resolution_criteria}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Progress bar for O/U */}
      {paceText && progressPct !== null && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-[#71717a] font-mono">{paceText}</span>
            <span
              className={
                prop.current_value! > prop.threshold!
                  ? "text-green-500 font-bold"
                  : "text-amber-400 font-bold"
              }
            >
              {prop.current_value! > prop.threshold! ? "OVER" : "UNDER"}
            </span>
          </div>
          <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                prop.current_value! > prop.threshold!
                  ? "bg-green-500"
                  : "bg-amber-400"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressPct, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Options */}
      {showResult && isResolved ? (
        <ResolvedView prop={prop} selection={selection} />
      ) : prop.options.length >= 6 ? (
        <div className="flex flex-col gap-2">
          {prop.options.map((option, i) => (
            <PickButton
              key={option.value}
              label={option.label}
              odds={option.odds}
              selected={selection === option.value}
              disabled={locked || isResolved}
              onClick={() => onSelect(prop.id, option.value)}
              colorIndex={i}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {prop.options.map((option, i) => (
            <PickButton
              key={option.value}
              label={option.label}
              odds={option.odds}
              selected={selection === option.value}
              disabled={locked || isResolved}
              onClick={() => onSelect(prop.id, option.value)}
              colorIndex={i}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ResolvedView({ prop, selection }: { prop: Prop; selection: string | null }) {
  const userPicked = selection !== null;

  return (
    <div className="space-y-1.5">
      {prop.options.map((option: PropOption) => {
        const isWinner = option.value === prop.result;
        const isUserPick = option.value === selection;
        const points = oddsToPoints(option.odds);

        return (
          <div
            key={option.value}
            className={`flex items-center justify-between p-2.5 rounded-lg border ${
              isWinner
                ? "border-green-500/25 bg-green-500/[0.05]"
                : isUserPick
                ? "border-red-500/25 bg-red-500/[0.04]"
                : "border-[#1e1e24] bg-[#0f0f13]"
            }`}
          >
            <div className="flex items-center gap-2">
              {isWinner && (
                <span className="text-green-500 text-xs">&#10003;</span>
              )}
              {isUserPick && !isWinner && (
                <span className="text-red-400 text-xs">&#10007;</span>
              )}
              <span
                className={`text-sm ${
                  isWinner ? "text-green-400 font-medium" : "text-[#71717a]"
                }`}
              >
                {option.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#71717a]">
                {formatOdds(option.odds)}
              </span>
              {isWinner && isUserPick && (
                <span className="text-xs font-bold text-green-500">
                  +{formatPoints(points)}
                </span>
              )}
              {isUserPick && !isWinner && (
                <span className="text-xs font-bold text-red-400">+0</span>
              )}
            </div>
          </div>
        );
      })}
      {!userPicked && (
        <p className="text-[11px] text-[#71717a] text-center pt-1">
          No pick made
        </p>
      )}
    </div>
  );
}
