import type { GameEvent } from "../types";

export function turnChanged(
  playerId: string,
  turnNumber: number,
): GameEvent {
  return { type: "TURN_CHANGED", playerId, turnNumber };
}

export function gameFinished(winnerId: string): GameEvent {
  return { type: "GAME_FINISHED", winnerId };
}
