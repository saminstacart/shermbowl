import { oddsToPoints, type Prop, type Pick } from "./types";

export function calculatePlayerScore(
  picks: Pick[],
  props: Prop[]
): { total: number; maxPossible: number; correct: number; resolved: number } {
  const propMap = new Map(props.map((p) => [p.id, p]));
  let total = 0;
  let maxPossible = 0;
  let correct = 0;
  let resolved = 0;

  for (const pick of picks) {
    const prop = propMap.get(pick.prop_id);
    if (!prop) continue;

    const selectedOption = prop.options.find((o) => o.value === pick.selection);
    if (!selectedOption) continue;

    const pointValue = oddsToPoints(selectedOption.odds);

    if (prop.status === "resolved") {
      resolved++;
      if (prop.result === pick.selection) {
        total += pointValue;
        maxPossible += pointValue;
        correct++;
      }
    } else {
      // Unresolved — add to max possible
      maxPossible += pointValue;
    }
  }

  // Also add max possible for props the player didn't pick (they get 0 either way)
  return { total, maxPossible: total + (maxPossible - total), correct, resolved };
}

export function recalculateLeaderboard(
  players: { id: string; name: string }[],
  allPicks: Pick[],
  props: Prop[]
) {
  const picksByPlayer = new Map<string, Pick[]>();
  for (const pick of allPicks) {
    const existing = picksByPlayer.get(pick.player_id) || [];
    existing.push(pick);
    picksByPlayer.set(pick.player_id, existing);
  }

  const entries = players.map((player) => {
    const playerPicks = picksByPlayer.get(player.id) || [];
    const { total, maxPossible, correct, resolved } = calculatePlayerScore(
      playerPicks,
      props
    );
    return {
      player_id: player.id,
      name: player.name,
      total_points: total,
      max_possible: maxPossible,
      correct_count: correct,
      resolved_count: resolved,
    };
  });

  // Sort by total_points desc, then max_possible desc
  entries.sort((a, b) => {
    if (b.total_points !== a.total_points)
      return b.total_points - a.total_points;
    return b.max_possible - a.max_possible;
  });

  return entries.map((e, i) => ({
    ...e,
    rank: i + 1,
    prev_rank: null as number | null,
    last_points: null as number | null,
  }));
}
