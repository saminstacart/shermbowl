"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Prop } from "@/lib/types";

export function useRealtimeProps() {
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);

  const fetchProps = useCallback(async () => {
    const { data } = await supabase
      .from("props")
      .select("*")
      .order("sort_order", { ascending: true });

    if (data) {
      setProps(data as Prop[]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProps();

    const channel = supabase
      .channel("props_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "props" },
        () => {
          fetchProps();
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
        } else if (
          status === "TIMED_OUT" ||
          status === "CLOSED" ||
          status === "CHANNEL_ERROR"
        ) {
          setConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProps]);

  return { props, loading, connected };
}
