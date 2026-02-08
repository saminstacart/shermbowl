"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RulesModal({ isOpen, onClose }: RulesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-[#09090b]/98 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-md mx-auto h-full flex flex-col"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">
                  Rules
                </h2>
                <p className="text-[11px] text-[#71717a] uppercase tracking-wider mt-0.5">
                  ShermBowl LX
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-[#71717a] hover:text-[#e4e4e7] transition-colors p-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-28 space-y-6 scrollbar-thin">

              <Section title="The Pool">
                <ul className="space-y-1.5 text-[#e4e4e7] text-sm">
                  <Bullet>$50 buy-in &mdash; Venmo Sam before kickoff</Bullet>
                  <Bullet>Payouts: <span className="text-[#d4a853] font-bold">60%</span> to 1st, <span className="font-bold">30%</span> to 2nd, <span className="text-[#71717a] font-bold">10%</span> to 3rd</Bullet>
                  <Bullet>Pot scales with the number of players</Bullet>
                </ul>
              </Section>

              <Section title="How to Play">
                <ol className="space-y-1.5 text-[#e4e4e7] text-sm list-decimal list-inside">
                  <li>21 prop bets. Pick every single one &mdash; no skipping.</li>
                  <li>Each option has a point value. Favorites are worth less, underdogs are worth more.</li>
                  <li>Pick right = bank those points. Pick wrong = 0.</li>
                  <li>Most total points at the end wins.</li>
                </ol>
              </Section>

              <Section title="Point Values">
                <p className="text-[#e4e4e7] text-sm mb-2">
                  The point value is based on sportsbook odds &mdash; the harder the pick, the more it pays.
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-[#71717a]">Heavy fav (-300)</span>
                  <span className="text-green-500 font-mono font-medium">
                    1.33 pts
                  </span>
                  <span className="text-[#71717a]">Favorite (-200)</span>
                  <span className="text-green-500 font-mono font-medium">
                    1.50 pts
                  </span>
                  <span className="text-[#71717a]">Coin flip (-110)</span>
                  <span className="text-green-500 font-mono font-medium">
                    1.91 pts
                  </span>
                  <span className="text-[#71717a]">Underdog (+150)</span>
                  <span className="text-green-500 font-mono font-medium">
                    2.50 pts
                  </span>
                  <span className="text-[#71717a]">Big dog (+300)</span>
                  <span className="text-green-500 font-mono font-medium">
                    4.00 pts
                  </span>
                  <span className="text-[#71717a]">Longshot (+1000)</span>
                  <span className="text-green-500 font-mono font-medium">
                    11.00 pts
                  </span>
                </div>
                <p className="text-[#71717a] text-xs mt-2">
                  Same odds for everyone. Safe picks = consistent but low ceiling. Underdogs = boom or bust.
                </p>
                <p className="text-[#71717a]/50 text-[10px] mt-1.5">
                  Odds from DraftKings, locked before kickoff on Feb 8
                </p>
              </Section>

              <Section title="Deadlines">
                <ul className="space-y-1.5 text-[#e4e4e7] text-sm">
                  <Bullet>
                    Picks lock at <span className="text-white font-bold">6:25 PM ET</span> on Feb 8 (5 min before kickoff)
                  </Bullet>
                  <Bullet>
                    Change your picks as many times as you want before lock
                  </Bullet>
                  <Bullet>
                    After lock, all picks are revealed to everyone
                  </Bullet>
                  <Bullet>
                    No exceptions. No late entries. No extensions.
                  </Bullet>
                </ul>
              </Section>

              <Section title="Resolution">
                <ul className="space-y-1.5 text-[#e4e4e7] text-sm">
                  <Bullet>
                    Props resolve using official NFL box score and broadcast
                  </Bullet>
                  <Bullet>
                    Tap any prop to see its exact resolution criteria
                  </Bullet>
                  <Bullet>
                    Stat corrections after the broadcast don&apos;t count
                  </Bullet>
                  <Bullet>
                    If a prop is voided or hits the exact line, it&apos;s a push &mdash; that prop scores 0 for everyone
                  </Bullet>
                  <Bullet>
                    Edge cases decided by commish (Sam) referencing broadcast footage &mdash; disputes reviewed with the group
                  </Bullet>
                </ul>
              </Section>

              <Section title="Tiebreakers">
                <ul className="space-y-1.5 text-[#e4e4e7] text-sm">
                  <Bullet>
                    Same score? The player who picked more underdogs wins &mdash; bigger swings get rewarded
                  </Bullet>
                  <Bullet>
                    Still tied after that? Those players split the payout evenly
                  </Bullet>
                </ul>
              </Section>

              <Section title="Fine Print">
                <ul className="space-y-1.5 text-[#e4e4e7] text-sm">
                  <Bullet>Picks are hidden until lock &mdash; no copying</Bullet>
                  <Bullet>Pick as yourself &mdash; honor system</Bullet>
                  <Bullet>No pick trading</Bullet>
                </ul>
              </Section>

              <Section title="Live Leaderboard">
                <p className="text-[#e4e4e7] text-sm mb-1.5">
                  During the game you&apos;ll see a live leaderboard with:
                </p>
                <ul className="space-y-1.5 text-[#e4e4e7] text-sm">
                  <Bullet>
                    <span className="text-green-500 font-bold">Pts</span> = confirmed points from resolved picks
                  </Bullet>
                  <Bullet>
                    <span className="text-red-400 font-bold">Proj</span> = projected total if current game trends hold
                  </Bullet>
                  <Bullet>
                    <span className="text-[#71717a] font-bold">Ceil</span> = your max possible if every remaining pick hits (varies per person)
                  </Bullet>
                </ul>
                <p className="text-[#71717a] text-xs mt-2">
                  Progress bar: green = earned, amber = trending, gray = still in play, empty = lost.
                </p>
              </Section>
            </div>

            {/* Got it button */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent">
              <button
                onClick={onClose}
                className="w-full py-3 bg-green-500 hover:bg-green-400 text-[#09090b] font-bold text-sm rounded-xl transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold tracking-[0.15em] uppercase text-green-500/70 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-2 shrink-0 block w-1 h-1 rounded-full bg-[#71717a]" />
      <span>{children}</span>
    </li>
  );
}

export function useRulesModal() {
  const [showRules, setShowRules] = useState(false);

  const openRules = useCallback(() => setShowRules(true), []);
  const closeRules = useCallback(() => setShowRules(false), []);

  function RulesButton({ className }: { className?: string }) {
    return (
      <button
        onClick={openRules}
        className={
          className ??
          "text-[11px] text-[#71717a] hover:text-green-500 transition-colors px-2.5 py-1 rounded-lg border border-[#27272a] hover:border-green-500/20"
        }
      >
        Rules
      </button>
    );
  }

  return { showRules, setShowRules, openRules, closeRules, RulesButton };
}
