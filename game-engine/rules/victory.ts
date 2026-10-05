import { computeScore } from "./scoring";
import type { GameState } from "../types";

/**
 * Official tie-break: most prestige, then fewest development cards bought. The
 * rulebook says nothing beyond that, so a full tie goes to the earlier seat.
 * Scores are recomputed from cards and nobles rather than trusting `points`.
 */
export function determineWinner(state: GameState): string {
  const ranked = [...state.players].sort((a, b) => {
    const diff = computeScore(b) - computeScore(a);
    if (diff !== 0) {
      return diff;
    }
    return a.cards.length - b.cards.length;
  });
  return ranked[0].id;
}

export function shouldEndGame(state: GameState, actingPlayerId: string): boolean {
  if (!state.endgameTriggered) {
    return false;
  }
  const lastPlayer = state.players[state.players.length - 1];
  return lastPlayer.id === actingPlayerId;
}
