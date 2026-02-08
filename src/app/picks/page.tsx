"use client";
import { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { motion, AnimatePresence } from "framer-motion";
import PropCard from "@/components/PropCard";
import CountdownTimer from "@/components/CountdownTimer";
import RulesModal from "@/components/RulesModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { Prop } from "@/lib/types";
import { oddsToPoints } from "@/lib/types";

const CATEGORY_FLAVOR: Record<string, { title: string; subtitle: string }> = {
  game: { title: "Game", subtitle: "The big picture" },
  player: { title: "Player", subtitle: "Who shows up?" },
  fun: { title: "Fun", subtitle: "The real competition" },
  degen: { title: "Degen", subtitle: "Alumni specials" },
};

export default function PicksPage() {
  const [props, setProps] = useState<Prop[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [propsError, setPropsError] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [loadedFromBackup, setLoadedFromBackup] = useState(false);
  const [showFirstTip, setShowFirstTip] = useState(false);
  const [pulsingCat, setPulsingCat] = useState<string | null>(null);
  const [urgencyLevel, setUrgencyLevel] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevCatComplete = useRef<Record<string, boolean>>({});
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const lockTime = process.env.NEXT_PUBLIC_LOCK_TIME || "";
  const isLocked = lockTime ? new Date() > new Date(lockTime) : false;

  // --- Auth check ---
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

  // --- Initialize localStorage-backed state ---
  useEffect(() => {
    const stored = localStorage.getItem("shermbowl_summary_open");
    if (stored !== null) setSummaryOpen(stored === "true");
    if (!localStorage.getItem("shermbowl_first_tip_seen")) {
      setShowFirstTip(true);
    }
  }, []);

  // --- Load props ---
  const loadProps = useCallback(() => {
    setPropsError(false);
    setLoading(true);
    import("@/lib/supabase")
      .then(({ supabase }) => {
        supabase
          .from("props")
          .select("*")
          .order("sort_order", { ascending: true })
          .then(({ data, error }) => {
            if (error || !data) {
              setPropsError(true);
            } else {
              setProps(data as Prop[]);
            }
            setLoading(false);
          });
      })
      .catch(() => {
        setPropsError(true);
        setLoading(false);
      });
  }, []);

  // --- Load picks + props on mount ---
  useEffect(() => {
    const pid = Cookies.get("shermbowl_player_id") || "";
    fetch("/api/picks?player_id=" + pid)
      .then((r) => r.json())
      .then((picks) => {
        if (Array.isArray(picks)) {
          const map: Record<string, string> = {};
          for (const p of picks) {
            map[p.prop_id] = p.selection;
          }
          setSelections(map);
        }
      })
      .catch(() => {
        try {
          const backup = localStorage.getItem("shermbowl_picks_backup");
          if (backup) {
            const parsed = JSON.parse(backup);
            if (parsed.player_id === pid && parsed.selections) {
              setSelections(parsed.selections);
              setLoadedFromBackup(true);
            }
          }
        } catch {
          // ignore
        }
      });

    loadProps();
  }, [loadProps]);

  // --- Urgency timer ---
  useEffect(() => {
    if (!lockTime) return;
    const check = () => {
      const diff = new Date(lockTime).getTime() - Date.now();
      const mins = diff / 60000;
      if (mins <= 5) setUrgencyLevel("critical");
      else if (mins <= 10) setUrgencyLevel("high");
      else if (mins <= 30) setUrgencyLevel("medium");
      else if (mins <= 60) setUrgencyLevel("low");
      else setUrgencyLevel(null);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [lockTime]);

  // --- Computed values ---
  const categories = useMemo(() => {
    return [
      { key: "game", props: props.filter((p) => p.category === "game") },
      { key: "player", props: props.filter((p) => p.category === "player") },
      { key: "fun", props: props.filter((p) => p.category === "fun") },
      { key: "degen", props: props.filter((p) => p.category === "degen") },
    ].filter((c) => c.props.length > 0);
  }, [props]);

  const pickedCount = Object.values(selections).filter(Boolean).length;
  const totalProps = props.length;
  const allPicked = totalProps > 0 && pickedCount === totalProps;

  const picksSummary = useMemo(() => {
    const selectedOptions: { category: string; odds: number; points: number }[] = [];
    for (const [propId, value] of Object.entries(selections)) {
      if (!value) continue;
      const prop = props.find((p) => p.id === propId);
      if (!prop) continue;
      const option = prop.options.find((o) => o.value === value);
      if (!option) continue;
      selectedOptions.push({
        category: prop.category,
        odds: option.odds,
        points: oddsToPoints(option.odds),
      });
    }

    const totalPoints = selectedOptions.reduce((sum, o) => sum + o.points, 0);

    // Board max: sum of the highest-point option for every prop
    const boardMax = props.reduce((sum, prop) => {
      if (prop.options.length === 0) return sum;
      const maxOpt = prop.options.reduce((best, o) =>
        oddsToPoints(o.odds) > oddsToPoints(best.odds) ? o : best
      );
      return sum + oddsToPoints(maxOpt.odds);
    }, 0);

    // Conservative floor: sum of the lowest-point (safest) option for every prop
    const boardMin = props.reduce((sum, prop) => {
      if (prop.options.length === 0) return sum;
      const minOpt = prop.options.reduce((best, o) =>
        oddsToPoints(o.odds) < oddsToPoints(best.odds) ? o : best
      );
      return sum + oddsToPoints(minOpt.odds);
    }, 0);

    const catBreakdown = categories.map((cat) => {
      const catPicks = selectedOptions.filter((o) => o.category === cat.key);
      const catMax = cat.props.reduce((sum, prop) => {
        if (prop.options.length === 0) return sum;
        const maxOpt = prop.options.reduce((best, o) =>
          oddsToPoints(o.odds) > oddsToPoints(best.odds) ? o : best
        );
        return sum + oddsToPoints(maxOpt.odds);
      }, 0);
      return {
        key: cat.key,
        picked: catPicks.length,
        total: cat.props.length,
        points: catPicks.reduce((sum, o) => sum + o.points, 0),
        maxPoints: catMax,
      };
    });

    const favorites = selectedOptions.filter((o) => o.odds < 0).length;
    const underdogs = selectedOptions.filter((o) => o.odds > 0 && o.odds < 300).length;
    const longshots = selectedOptions.filter((o) => o.odds >= 300).length;
    const total = selectedOptions.length;

    let style = "Balanced";
    if (total > 0) {
      const favPct = favorites / total;
      const dogPct = underdogs / total;
      const longPct = longshots / total;
      if (longPct > 0.6) style = "Full Degen";
      else if (dogPct > 0.6) style = "Bold";
      else if (favPct > 0.6) style = "Conservative";
    }

    return { totalPoints, boardMax, boardMin, catBreakdown, favorites, underdogs, longshots, style, total };
  }, [selections, props, categories]);

  // --- Handlers ---
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1200);
  };

  const handleSelect = useCallback(
    (propId: string, value: string) => {
      if (isLocked) return;
      setSelections((prev) => {
        const isToggleOff = prev[propId] === value;
        showToast(isToggleOff ? "Removed" : "Saved");
        return {
          ...prev,
          [propId]: isToggleOff ? "" : value,
        };
      });
    },
    [isLocked]
  );

  const handleSave = async () => {
    if (!playerId || isLocked) return;
    setSaving(true);
    setSaveError(null);

    const picksToSave = Object.entries(selections)
      .filter(([, v]) => v)
      .map(([prop_id, selection]) => ({ prop_id, selection }));

    const MAX_RETRIES = 4;
    const backoff = [0, 1000, 3000, 8000];
    const jitterMax = [0, 500, 1000, 2000];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: playerId, picks: picksToSave }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveError(null);
        setLoadedFromBackup(false);
        setSaving(false);
        return;
      } catch {
        if (attempt < MAX_RETRIES) {
          setSaveError("Save failed \u2014 retrying...");
          await new Promise((r) =>
            setTimeout(r, backoff[attempt] + Math.random() * jitterMax[attempt])
          );
        } else {
          setSaveError("Could not save picks. Check your connection.");
        }
      }
    }
    setSaving(false);
  };

  const handleLockIn = () => {
    if (pickedCount < totalProps) return;
    setShowConfirm(true);
  };

  const confirmLockIn = async () => {
    setShowConfirm(false);
    await handleSave();
    router.push("/waiting");
  };

  const toggleSummary = () => {
    setSummaryOpen((prev) => {
      const next = !prev;
      localStorage.setItem("shermbowl_summary_open", String(next));
      return next;
    });
  };

  const jumpToNextUnpicked = () => {
    for (const cat of categories) {
      for (const prop of cat.props) {
        if (!selections[prop.id]) {
          const el = document.getElementById(`prop-${prop.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-1", "ring-green-500/30");
            setTimeout(
              () => el.classList.remove("ring-1", "ring-green-500/30"),
              2000
            );
          }
          return;
        }
      }
    }
  };

  // --- Effects that depend on handlers ---

  // Auto-save on selection change
  useEffect(() => {
    if (!playerId || isLocked) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, playerId, isLocked]);

  // Check for lock expiry
  useEffect(() => {
    const interval = setInterval(() => {
      if (lockTime && new Date() > new Date(lockTime)) {
        handleSave();
        router.push("/waiting");
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockTime, router]);

  // localStorage backup
  useEffect(() => {
    if (!playerId || Object.keys(selections).length === 0) return;
    localStorage.setItem(
      "shermbowl_picks_backup",
      JSON.stringify({
        player_id: playerId,
        selections,
        timestamp: Date.now(),
      })
    );
  }, [selections, playerId]);

  // First-pick tooltip dismissal
  useEffect(() => {
    if (pickedCount > 0 && showFirstTip) {
      setShowFirstTip(false);
      localStorage.setItem("shermbowl_first_tip_seen", "true");
    }
  }, [pickedCount, showFirstTip]);

  // Category completion animation
  useEffect(() => {
    for (const cat of categories) {
      const picked = cat.props.filter((p) => selections[p.id]).length;
      const complete = picked === cat.props.length && cat.props.length > 0;
      const wasComplete = prevCatComplete.current[cat.key] || false;
      if (complete && !wasComplete) {
        setPulsingCat(cat.key);
        setTimeout(() => setPulsingCat(null), 600);
      }
      prevCatComplete.current[cat.key] = complete;
    }
  }, [selections, categories]);


  // --- Render ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* Header — sticky with compact scoring row */}
      <div className="sticky top-0 z-40 glass border-b border-[#27272a] px-5 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-bold text-white">Make Your Picks</h1>
              <p className="text-[11px] text-[#71717a]">{playerName}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRules(true)}
                className="text-[11px] text-[#71717a] hover:text-green-500 transition-colors px-2 py-0.5 rounded border border-[#27272a] hover:border-green-500/20"
              >
                Rules
              </button>
              {lockTime && <CountdownTimer targetTime={lockTime} />}
            </div>
          </div>
          {/* Compact scoring row — always visible in header */}
          {props.length > 0 && (
            <div
              className="mt-2 pt-2 border-t border-[#27272a]/50 cursor-pointer"
              onClick={!allPicked ? jumpToNextUnpicked : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-sm font-bold text-[#d4a853]">
                    {pickedCount > 0 ? picksSummary.totalPoints.toFixed(1) : "0"}
                  </span>
                  <span className="text-[10px] text-[#71717a]">
                    {pickedCount > 0 ? "if you sweep" : "pts"}
                  </span>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-[#1c1c24] overflow-hidden">
                  {totalProps > 0 && (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        allPicked
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-[#d4a853] to-[#22c55e]"
                      }`}
                      style={{ width: `${(pickedCount / totalProps) * 100}%` }}
                    />
                  )}
                </div>
                <span className="font-mono text-[11px] font-bold text-green-500">
                  {pickedCount}/{totalProps}
                </span>
              </div>
              {pickedCount > 0 && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-[#71717a]/60">
                    {picksSummary.style} &mdash; range {picksSummary.boardMin.toFixed(0)}&ndash;{picksSummary.boardMax.toFixed(0)}
                  </span>
                  {!allPicked && (
                    <span className="text-[10px] text-green-500/50">
                      tap to jump to next &rsaquo;
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Urgency banner */}
      {urgencyLevel && !isLocked && pickedCount < totalProps && (
        <div
          className={`px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${
            urgencyLevel === "critical"
              ? "bg-red-500/20 text-red-300 animate-pulse"
              : urgencyLevel === "high"
              ? "bg-red-900/20 text-red-300/80"
              : urgencyLevel === "medium"
              ? "bg-amber-900/15 text-amber-300/70"
              : "bg-amber-900/10 text-amber-300/50"
          }`}
        >
          {urgencyLevel === "critical"
            ? "Picks lock in less than 5 minutes"
            : urgencyLevel === "high"
            ? "Less than 10 minutes until lock"
            : urgencyLevel === "medium"
            ? "30 minutes until picks lock"
            : "1 hour until picks lock"}
        </div>
      )}

      <div className="max-w-lg mx-auto px-5 py-4 space-y-6">
        {/* Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0f0f13] border border-[#27272a]">
            <svg
              className="w-3.5 h-3.5 text-[#71717a] flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
            <span className="text-[11px] text-[#71717a]">
              Picks hidden from others until lock
            </span>
          </div>
          <p className="text-[11px] text-[#71717a] text-center">
            Auto-saved as you pick
          </p>
        </div>

        {/* Category quick nav */}
        {categories.length > 1 && (
          <div className="flex gap-1.5">
            {categories.map((cat) => {
              const picked = cat.props.filter((p) => selections[p.id]).length;
              const complete = picked === cat.props.length;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    sectionRefs.current[cat.key]?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                    complete
                      ? "border-green-500/20 bg-green-500/[0.05] text-green-500"
                      : "border-[#27272a] bg-[#0f0f13] text-[#71717a] hover:text-[#e4e4e7]"
                  } ${pulsingCat === cat.key ? "cat-pulse" : ""}`}
                >
                  {CATEGORY_FLAVOR[cat.key]?.title || cat.key}
                  {complete && " \u2713"}
                </button>
              );
            })}
          </div>
        )}

        {/* Picks Strategy Panel — always visible */}
        {props.length > 0 && (
          <div ref={dashboardRef} className="bg-[#0f0f13] border border-[#27272a] rounded-xl overflow-hidden">
            <button
              onClick={toggleSummary}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#71717a]">
                Scoring Dashboard
              </span>
              <div className="flex items-center gap-2">
                {pickedCount > 0 && (
                  <span className="font-mono text-xs text-[#d4a853] font-bold">
                    {picksSummary.totalPoints.toFixed(1)} pts
                  </span>
                )}
                <span className="text-[#71717a] text-xs">
                  {summaryOpen ? "\u25B2" : "\u25BC"}
                </span>
              </div>
            </button>

            {summaryOpen && (
              <div className="px-4 pb-4 space-y-3">
                {/* Points bar visualization */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#71717a]">Your picks vs. board</span>
                    <span className="font-mono text-[#71717a]">
                      {picksSummary.boardMax.toFixed(1)} max
                    </span>
                  </div>
                  <div className="relative h-6 rounded-lg bg-[#16161c] overflow-hidden">
                    {/* Board max reference line */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-full opacity-10 bg-[#27272a]" />
                    </div>
                    {/* Your points bar */}
                    {pickedCount > 0 && picksSummary.boardMax > 0 && (
                      <div
                        className="absolute left-0 top-0 h-full rounded-lg bg-gradient-to-r from-[#d4a853] to-[#22c55e] transition-all duration-500"
                        style={{
                          width: `${Math.min((picksSummary.totalPoints / picksSummary.boardMax) * 100, 100)}%`,
                        }}
                      />
                    )}
                    {/* Conservative floor marker */}
                    {picksSummary.boardMax > 0 && (
                      <div
                        className="absolute top-0 h-full w-px bg-[#71717a]/40"
                        style={{
                          left: `${(picksSummary.boardMin / picksSummary.boardMax) * 100}%`,
                        }}
                      />
                    )}
                    {/* Center label */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-mono text-xs font-bold text-white drop-shadow-md">
                        {pickedCount > 0
                          ? `${picksSummary.totalPoints.toFixed(1)} / ${picksSummary.boardMax.toFixed(1)}`
                          : `0 / ${picksSummary.boardMax.toFixed(1)} available`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                    <span>
                      Safe floor: {picksSummary.boardMin.toFixed(1)}
                    </span>
                    <span>
                      Degen ceiling: {picksSummary.boardMax.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#27272a]" />

                {/* Category breakdown */}
                <div className="space-y-2">
                  {picksSummary.catBreakdown.map((cat) => (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[#e4e4e7] font-medium w-14">
                            {CATEGORY_FLAVOR[cat.key]?.title || cat.key}
                          </span>
                          <span className="font-mono text-[#71717a] tracking-wider">
                            {Array.from({ length: cat.total }, (_, i) =>
                              i < cat.picked ? "\u25CF" : "\u25CB"
                            ).join("")}
                          </span>
                        </div>
                        <span className="font-mono text-[#e4e4e7]">
                          {cat.points.toFixed(1)}{" "}
                          <span className="text-[#71717a]">/ {cat.maxPoints.toFixed(1)}</span>
                        </span>
                      </div>
                      {/* Mini bar per category */}
                      <div className="h-1 rounded-full bg-[#16161c] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500/60 transition-all duration-300"
                          style={{
                            width: cat.maxPoints > 0
                              ? `${(cat.points / cat.maxPoints) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pick Style — only show once picks exist */}
                {pickedCount > 0 && (
                  <>
                    <div className="border-t border-[#27272a]" />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#71717a]">Pick Style:</span>
                        <span className="text-[11px] font-bold text-[#e4e4e7]">
                          {picksSummary.style}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-[#27272a]">
                          {picksSummary.total > 0 && (
                            <>
                              {picksSummary.favorites > 0 && (
                                <div
                                  className="bg-green-500 h-full"
                                  style={{
                                    width: `${(picksSummary.favorites / picksSummary.total) * 100}%`,
                                  }}
                                />
                              )}
                              {picksSummary.underdogs > 0 && (
                                <div
                                  className="bg-amber-500 h-full"
                                  style={{
                                    width: `${(picksSummary.underdogs / picksSummary.total) * 100}%`,
                                  }}
                                />
                              )}
                              {picksSummary.longshots > 0 && (
                                <div
                                  className="bg-red-500 h-full"
                                  style={{
                                    width: `${(picksSummary.longshots / picksSummary.total) * 100}%`,
                                  }}
                                />
                              )}
                            </>
                          )}
                        </div>
                        <span className="text-[11px] text-[#71717a] font-mono whitespace-nowrap">
                          {picksSummary.favorites} fav / {picksSummary.underdogs} dog /{" "}
                          {picksSummary.longshots} long
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loaded from backup banner */}
        {loadedFromBackup && (
          <div className="px-4 py-2 rounded-lg text-center text-[11px] font-bold bg-amber-900/15 text-amber-300/70">
            Loaded from local backup. Will sync when connection restores.
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div
            className={`px-4 py-2 rounded-lg text-center text-[11px] font-bold ${
              saveError.includes("retrying")
                ? "bg-amber-900/15 text-amber-300/70"
                : "bg-red-900/15 text-red-300/80"
            }`}
          >
            {saveError}
          </div>
        )}

        {/* Props by category */}
        <ErrorBoundary fallbackMessage="Could not load props. Reload to try again.">
          {propsError ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-[#71717a] text-sm">
                Props are loading... Hang tight.
              </p>
              <button
                onClick={loadProps}
                className="px-4 py-2 bg-[#16161c] border border-[#27272a] text-[#e4e4e7] rounded-lg text-sm font-medium hover:bg-[#0f0f13] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {categories.map((cat, catIndex) => {
                const picked = cat.props.filter((p) => selections[p.id]).length;
                const flavor = CATEGORY_FLAVOR[cat.key];
                return (
                  <Section
                    key={cat.key}
                    ref={(el) => {
                      sectionRefs.current[cat.key] = el;
                    }}
                    title={flavor?.title || cat.key}
                    subtitle={flavor?.subtitle}
                    count={picked}
                    total={cat.props.length}
                  >
                    {cat.props.map((prop, propIndex) => (
                      <div
                        key={prop.id}
                        id={`prop-${prop.id}`}
                        className="transition-all rounded-xl relative scroll-mt-32"
                      >
                        {showFirstTip &&
                          catIndex === 0 &&
                          propIndex === 0 &&
                          pickedCount === 0 && (
                            <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-[#16161c] border border-[#27272a] rounded-lg text-[11px] text-[#e4e4e7] whitespace-nowrap shadow-lg">
                              Tap an option. The number = points if you&apos;re right.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#16161c] border-r border-b border-[#27272a] rotate-45 -mt-1" />
                            </div>
                          )}
                        <PropCard
                          prop={prop}
                          selection={selections[prop.id] || null}
                          onSelect={handleSelect}
                          locked={isLocked}
                        />
                      </div>
                    ))}
                  </Section>
                );
              })}

              {totalProps === 0 && !propsError && (
                <div className="text-center py-12">
                  <p className="text-[#71717a] text-sm">No props loaded yet.</p>
                  <p className="text-[11px] text-[#71717a] mt-1">
                    The commissioner needs to seed the props.
                  </p>
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#16161c] border border-[#27272a] rounded-full text-[11px] text-[#e4e4e7] shadow-lg font-medium"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock-in confirmation */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f13] border border-[#27272a] rounded-2xl p-6 max-w-sm w-full space-y-4"
            >
              <h3 className="text-base font-bold text-white text-center">
                Lock in all {totalProps} picks?
              </h3>
              <p className="text-sm text-[#71717a] text-center">
                You won&apos;t be able to change them after.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 border border-[#27272a] text-[#71717a] rounded-xl text-sm font-medium hover:bg-[#16161c]"
                >
                  Keep Editing
                </button>
                <button
                  onClick={confirmLockIn}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-[#09090b] font-bold rounded-xl text-sm"
                >
                  Lock In
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#27272a] safe-area-bottom" style={{ background: "rgba(9, 9, 11, 0.97)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <button onClick={jumpToNextUnpicked} className="text-sm cursor-pointer flex-shrink-0">
            <span className="text-green-500 font-bold font-mono">{pickedCount}</span>
            <span className="text-[#71717a] font-mono">/{totalProps}</span>
            {!allPicked && pickedCount > 0 && (
              <span className="text-[#71717a] ml-1.5 text-[11px]">
                {totalProps - pickedCount <= 3
                  ? `${totalProps - pickedCount} left!`
                  : "Tap to find next"}
              </span>
            )}
            {!allPicked && pickedCount === 0 && (
              <span className="text-[#71717a] ml-1.5 text-[11px]">
                Pick all to lock in
              </span>
            )}
            {allPicked && (
              <span className="text-green-500 ml-1.5 text-[11px] font-bold">
                Ready!
              </span>
            )}
          </button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={allPicked ? handleLockIn : jumpToNextUnpicked}
            disabled={isLocked}
            animate={allPicked && !isLocked ? { scale: [1, 1.03, 1] } : {}}
            transition={allPicked ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
            className={`px-6 py-2.5 font-bold rounded-xl transition-all text-sm whitespace-nowrap ${
              allPicked && !isLocked
                ? "bg-green-500 hover:bg-green-400 text-[#09090b] glow-selected shadow-lg shadow-green-500/20"
                : pickedCount > 0 && !isLocked
                ? "bg-[#d4a853] hover:bg-[#d4a853]/90 text-[#09090b]"
                : "bg-[#16161c] text-[#71717a] cursor-not-allowed"
            }`}
          >
            {saving
              ? "Saving..."
              : allPicked
              ? "Lock In \u2192"
              : totalProps - pickedCount <= 5 && pickedCount > 0
              ? `${totalProps - pickedCount} more \u2192`
              : pickedCount > 0
              ? "Next pick \u2192"
              : `Pick ${totalProps} props`}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

const Section = forwardRef<
  HTMLDivElement,
  {
    title: string;
    subtitle?: string;
    count: number;
    total: number;
    children: React.ReactNode;
  }
>(function Section({ title, subtitle, count, total, children }, ref) {
  const complete = count === total;
  return (
    <div ref={ref}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#71717a]">
            {title}
            {complete && (
              <span className="text-green-500 ml-1">{"\u2713"}</span>
            )}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-[#71717a]/60 italic">{subtitle}</p>
          )}
        </div>
        <span
          className={`text-[11px] font-mono ${
            complete ? "text-green-500" : "text-[#71717a]"
          }`}
        >
          {count}/{total}
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
});
