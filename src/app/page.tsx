"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { motion } from "framer-motion";
import CountdownTimer from "@/components/CountdownTimer";
import RulesModal from "@/components/RulesModal";

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

interface PlayerInfo {
  id: string;
  name: string;
  picks_count: number;
}

export default function Home() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [takenNames, setTakenNames] = useState<Set<string>>(new Set());
  const [showRules, setShowRules] = useState(false);

  const [returningUser, setReturningUser] = useState<{
    name: string;
    picksCount: number;
  } | null>(null);
  const [checkingCookie, setCheckingCookie] = useState(true);

  const router = useRouter();

  const lockTime = process.env.NEXT_PUBLIC_LOCK_TIME || "";
  const isLocked = lockTime ? new Date() > new Date(lockTime) : false;
  const destination = isLocked ? "/live" : "/picks";

  useEffect(() => {
    const playerId = Cookies.get("shermbowl_player_id");
    const playerName = Cookies.get("shermbowl_player_name");

    if (playerId && playerName) {
      fetch("/api/players")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const me = data.find((p: PlayerInfo) => p.id === playerId);
            setReturningUser({
              name: playerName,
              picksCount: me?.picks_count ?? 0,
            });
          }
        })
        .catch(() => {
          setReturningUser({ name: playerName, picksCount: 0 });
        })
        .finally(() => setCheckingCookie(false));
    } else {
      setCheckingCookie(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const names = new Set<string>(data.map((p: PlayerInfo) => p.name));
          setTakenNames(names);
        }
      })
      .catch(() => {});
  }, []);

  const handleNameTap = (name: string) => {
    setSelectedName(name);
    setConfirming(true);
    setError("");
  };

  const handleConfirm = async () => {
    if (!selectedName) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      Cookies.set("shermbowl_player_id", data.id, { expires: 7 });
      Cookies.set("shermbowl_player_name", data.name, { expires: 7 });

      const rulesSeen = localStorage.getItem("shermbowl_rules_seen");
      if (!rulesSeen) {
        setShowRules(true);
        return;
      }

      router.push(destination);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRulesClose = useCallback(() => {
    setShowRules(false);
    localStorage.setItem("shermbowl_rules_seen", "true");
    const playerId = Cookies.get("shermbowl_player_id");
    if (playerId) {
      router.push(destination);
    }
  }, [router, destination]);

  const handleGoBack = () => {
    setConfirming(false);
    setSelectedName(null);
    setError("");
  };

  const handleNotMe = () => {
    Cookies.remove("shermbowl_player_id");
    Cookies.remove("shermbowl_player_name");
    setReturningUser(null);
  };

  if (checkingCookie) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden">
      <div className="w-full max-w-lg space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowRules(true)}
              className="text-[11px] text-[#71717a] hover:text-green-500 transition-colors px-2.5 py-1 rounded-lg border border-[#27272a] hover:border-green-500/20"
            >
              Rules
            </button>
          </div>

          {/* Logo lockup — bespoke wordmark */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#C60C30" }} />
              <span className="text-[11px] tracking-[0.3em] uppercase text-[#71717a] font-medium">
                Super Bowl LX
              </span>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#69BE28" }} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">
              <span className="text-white">SHERM</span>
              <span className="text-gradient">BOWL</span>
            </h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="h-px flex-1 max-w-12 bg-gradient-to-r from-transparent to-[#27272a]" />
              <p className="text-[11px] tracking-[0.25em] uppercase text-[#d4a853] font-bold">
                Prop Bets
              </p>
              <div className="h-px flex-1 max-w-12 bg-gradient-to-l from-transparent to-[#27272a]" />
            </div>
          </motion.div>

          {/* Matchup — with team colors & logos */}
          <motion.div
            className="flex items-center justify-center gap-5 pt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="flex items-center gap-2.5 flex-1 justify-end">
              <div className="inline-flex flex-col items-end">
                <p className="text-lg font-extrabold tracking-wide" style={{ color: "#C60C30" }}>
                  {process.env.NEXT_PUBLIC_AWAY_TEAM || "NE"}
                </p>
                <p className="text-[11px]" style={{ color: "#B0B7BC" }}>
                  {process.env.NEXT_PUBLIC_AWAY_TEAM_FULL || "Patriots"}
                </p>
              </div>
              <img
                src="https://a.espncdn.com/i/teamlogos/nfl/500/ne.png"
                alt="Patriots"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-[#52525b] font-bold uppercase tracking-wider">vs</span>
              <div className="w-6 h-px bg-[#27272a]" />
            </div>
            <div className="flex items-center gap-2.5 flex-1">
              <img
                src="https://a.espncdn.com/i/teamlogos/nfl/500/sea.png"
                alt="Seahawks"
                className="w-10 h-10 object-contain"
              />
              <div className="inline-flex flex-col items-start">
                <p className="text-lg font-extrabold tracking-wide" style={{ color: "#69BE28" }}>
                  {process.env.NEXT_PUBLIC_HOME_TEAM || "SEA"}
                </p>
                <p className="text-[11px]" style={{ color: "#A5ACAF" }}>
                  {process.env.NEXT_PUBLIC_HOME_TEAM_FULL || "Seahawks"}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Countdown */}
        {!isLocked && lockTime && (
          <motion.div
            className="py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <CountdownTimer targetTime={lockTime} />
          </motion.div>
        )}

        {isLocked && (
          <div className="text-center py-3">
            <span className="text-xs text-red-400 font-bold uppercase tracking-wider">
              Picks are locked
            </span>
            <p className="text-[11px] text-[#71717a] mt-1">
              View the live leaderboard
            </p>
          </div>
        )}

        {/* Payout display */}
        <motion.div
          className="flex items-center justify-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-center">
            <p className="text-lg font-bold text-[#d4a853]">60%</p>
            <p className="text-[11px] text-[#71717a] uppercase">1st</p>
          </div>
          <div className="w-px h-8 bg-[#27272a]" />
          <div className="text-center">
            <p className="text-lg font-bold text-[#e4e4e7]">30%</p>
            <p className="text-[11px] text-[#71717a] uppercase">2nd</p>
          </div>
          <div className="w-px h-8 bg-[#27272a]" />
          <div className="text-center">
            <p className="text-lg font-bold text-[#71717a]">10%</p>
            <p className="text-[11px] text-[#71717a] uppercase">3rd</p>
          </div>
        </motion.div>
        <p className="text-[11px] text-[#71717a] text-center -mt-4">
          $50 buy-in &middot; pot splits by finish
        </p>

        {/* ---------- RETURNING USER ---------- */}
        {returningUser && !confirming ? (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-white">
                Welcome back, {returningUser.name}
              </p>
              {returningUser.picksCount > 0 && (
                <p className="text-sm text-[#71717a]">
                  <span className="text-green-500 font-semibold">
                    {returningUser.picksCount}
                  </span>{" "}
                  pick{returningUser.picksCount !== 1 ? "s" : ""} saved
                </p>
              )}
            </div>

            <button
              onClick={() => router.push(destination)}
              className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-[#09090b] font-bold rounded-xl transition-colors text-base glow-selected"
            >
              {isLocked ? "View Live" : "Continue to picks"}
            </button>

            <div className="text-center">
              <button
                onClick={handleNotMe}
                className="text-xs text-[#71717a] hover:text-[#e4e4e7] transition-colors"
              >
                Not {returningUser.name}?
              </button>
            </div>
          </motion.div>
        ) : confirming && selectedName ? (
          /* ---------- CONFIRMATION STEP ---------- */
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center space-y-2">
              <p className="text-sm text-[#71717a]">Joining as</p>
              <p className="text-3xl font-bold text-white">{selectedName}</p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-3.5 bg-green-500 hover:bg-green-400 disabled:bg-[#16161c] disabled:text-[#71717a] text-[#09090b] font-bold rounded-xl transition-colors text-base glow-selected"
            >
              {loading ? "Joining..." : "Let's go"}
            </button>

            <button
              onClick={handleGoBack}
              disabled={loading}
              className="w-full py-2.5 text-[#71717a] hover:text-white transition-colors text-sm"
            >
              Go back
            </button>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}
          </motion.div>
        ) : (
          /* ---------- NAME PICKER GRID ---------- */
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-center text-xs text-[#71717a] uppercase tracking-wider">
              Tap your name
            </p>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {ALLOWED_NAMES.map((name, i) => {
                const isTaken = takenNames.has(name);
                return (
                  <motion.button
                    key={name}
                    onClick={() => handleNameTap(name)}
                    whileTap={{ scale: 0.96 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.03 }}
                    className={`relative min-h-[60px] rounded-xl border font-semibold text-sm transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isTaken
                        ? "border-green-500/15 bg-green-500/[0.03] text-white hover:border-green-500/30"
                        : "border-[#27272a] bg-[#0f0f13] text-white hover:border-[#3a3a44] hover:bg-[#16161c]"
                    }`}
                  >
                    <span>{name}</span>
                    {isTaken && (
                      <span className="text-[11px] text-green-500/60 leading-none">
                        joined
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <p className="text-center text-[11px] text-[#71717a]">Pick YOUR name. Picks are hidden and final — honor system.</p>

            {takenNames.size > 0 && (
              <p className="text-center text-[11px] text-[#71717a]">
                {takenNames.size}/10 players in
              </p>
            )}
          </motion.div>
        )}
      </div>

      <RulesModal isOpen={showRules} onClose={handleRulesClose} />
    </div>
  );
}
