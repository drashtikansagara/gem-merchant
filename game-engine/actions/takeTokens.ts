import type { GameEvent, GameState, ResourceType, TakeTokensAction } from "../types";
import { countTokens, getPlayer } from "../helpers";
import { addTokens, removeTokens } from "../Player";
import { returnToBank, takeFromBank } from "../Token";
import { RESOURCE_TYPES } from "../types";

export function applyTakeTokens(
  state: GameState,
  playerId: string,
  action: TakeTokensAction,
  events: GameEvent[],
): void {
  const player = getPlayer(state, playerId);
  const taken = countTokens(action.tokens);
  takeFromBank(state, taken);
  addTokens(player, taken);
  events.push({ type: "TOKENS_TAKEN", playerId, tokens: action.tokens });
  returnDiscard(state, playerId, action.discard, events);
}

/** Hand tokens back to the bank to get down to the hand limit (already validated). */
export function returnDiscard(
  state: GameState,
  playerId: string,
  discard: Partial<Record<ResourceType, number>> = {},
  events: GameEvent[],
): void {
  const player = getPlayer(state, playerId);
  const hasDiscard = Object.values(discard).some((n) => (n ?? 0) > 0);
  if (hasDiscard) {
    const sanitized: Partial<Record<ResourceType, number>> = {};
    for (const gem of RESOURCE_TYPES) {
      if ((discard[gem] ?? 0) > 0) {
        sanitized[gem] = discard[gem];
      }
    }
    removeTokens(player, sanitized);
    returnToBank(state, sanitized);
    events.push({ type: "TOKENS_RETURNED", playerId, tokens: sanitized });
  }
}
