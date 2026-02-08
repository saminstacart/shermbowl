"use client";
import { useGameState } from "@/hooks/useGameState";
import { getQuarterLabel } from "@/lib/types";

export default function ScoreBar() {
  const game = useGameState();

  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";

  return (
    <div className="sticky top-0 z-50 glass border-b border-[#27272a] elevated-shadow">
      <div className="max-w-lg mx-auto flex items-center justify-between px-5 py-3">
        {/* Away team */}
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-semibold tracking-wider text-[#71717a] w-8 uppercase">
            {process.env.NEXT_PUBLIC_AWAY_TEAM || "NE"}
          </span>
          <span className="text-3xl font-extrabold text-white score-display">
            {game.away_score}
          </span>
        </div>

        {/* Status */}
        <div className="flex flex-col items-center px-4 min-w-[72px]">
          {game.status === "pre" ? (
            <span className="text-[11px] text-[#71717a] uppercase tracking-wider font-medium">
              Pre-Game
            </span>
          ) : isFinal ? (
            <span className="text-[11px] text-red-400 uppercase tracking-wider font-bold">
              Final
            </span>
          ) : game.status === "halftime" ? (
            <span className="text-[11px] text-amber-400 uppercase tracking-wider font-bold">
              Half
            </span>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {isLive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-ring" />
                )}
                <span className="text-[11px] text-red-500 uppercase tracking-wider font-bold">
                  {getQuarterLabel(game.quarter)}
                </span>
              </div>
              <span className="text-[11px] text-[#71717a] tabular-nums font-mono mt-0.5">
                {game.clock}
              </span>
            </>
          )}
        </div>

        {/* Home team */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-3xl font-extrabold text-white score-display">
            {game.home_score}
          </span>
          <span className="text-sm font-semibold tracking-wider text-[#71717a] w-8 text-right uppercase">
            {process.env.NEXT_PUBLIC_HOME_TEAM || "SEA"}
          </span>
        </div>
      </div>
    </div>
  );
}
