import type { PlayerState, ResourceType } from "./types";
import { totalTokens } from "./helpers";

export function tokenCount(player: PlayerState): number {
  return totalTokens(player.tokens);
}

export function addTokens(
  player: PlayerState,
  deltas: Partial<Record<ResourceType, number>>,
): void {
  for (const [type, amount] of Object.entries(deltas) as Array<
    [ResourceType, number]
  >) {
    player.tokens[type] += amount;
  }
}

export function removeTokens(
  player: PlayerState,
  deltas: Partial<Record<ResourceType, number>>,
): void {
  for (const [type, amount] of Object.entries(deltas) as Array<
    [ResourceType, number]
  >) {
    player.tokens[type] -= amount;
  }
}
