"use client";
import { motion, AnimatePresence } from "framer-motion";
import { formatOdds, oddsToPoints, formatPoints } from "@/lib/types";

// Distinct color palette for option differentiation
const OPTION_COLORS = [
  { text: "text-green-500/90", selectedText: "text-green-500" },
  { text: "text-blue-400/90", selectedText: "text-blue-400" },
  { text: "text-amber-400/90", selectedText: "text-amber-400" },
  { text: "text-red-400/90", selectedText: "text-red-400" },
  { text: "text-purple-400/90", selectedText: "text-purple-400" },
  { text: "text-cyan-400/90", selectedText: "text-cyan-400" },
];

interface PickButtonProps {
  label: string;
  odds: number;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  colorIndex?: number; // index within the prop's options for distinct coloring
}

export default function PickButton({
  label,
  odds,
  selected,
  disabled,
  onClick,
  colorIndex = 0,
}: PickButtonProps) {
  const points = oddsToPoints(odds);
  const color = OPTION_COLORS[colorIndex % OPTION_COLORS.length];

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      animate={selected ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-xl border transition-colors
        min-h-[72px] flex-1
        ${
          selected
            ? "border-green-500/40 bg-green-500/[0.07] glow-selected"
            : "border-[#27272a] bg-[#0f0f12] hover:border-[#3a3a44] hover:bg-[#15151b]"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span
        className={`text-sm font-semibold leading-tight ${
          selected ? "text-green-400" : "text-[#e4e4e7]"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-lg font-bold font-mono mt-1 ${
          selected ? color.selectedText : color.text
        }`}
      >
        {formatPoints(points)} pts
      </span>
      <span className="text-[11px] font-mono text-[#71717a] mt-0.5">
        {formatOdds(odds)}
      </span>
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20"
          >
            <svg className="w-2.5 h-2.5 text-[#09090b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
