"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { GameState } from "@/lib/types";

const defaultState: GameState = {
  id: 1,
  home_team: process.env.NEXT_PUBLIC_HOME_TEAM || "SEA",
  away_team: process.env.NEXT_PUBLIC_AWAY_TEAM || "NE",
  home_score: 0,
  away_score: 0,
  quarter: 0,
  clock: "0:00",
  status: "pre",
  last_play: null,
  updated_at: new Date().toISOString(),
};

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(defaultState);

  useEffect(() => {
    // Initial fetch
    supabase
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setGameState(data as GameState);
      });

    // Subscribe to changes
    const channel = supabase
      .channel("game_state_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_state" },
        (payload) => {
          setGameState(payload.new as GameState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return gameState;
}
