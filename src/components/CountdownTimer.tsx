"use client";
import { useEffect, useState } from "react";

export default function CountdownTimer({ targetTime }: { targetTime: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const target = new Date(targetTime).getTime();

    const update = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("0:00");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(
          `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        );
      } else {
        setTimeLeft(`${mins}:${String(secs).padStart(2, "0")}`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold tabular-nums text-white tracking-tight score-display">
        {timeLeft}
      </div>
      <div className="text-[11px] text-[#71717a] mt-1 uppercase tracking-wider font-medium">
        {expired ? "Locked" : "Until Lock"}
      </div>
    </div>
  );
}
