import { GAME_RULES } from "./rules/constants";
import type { Card, GameState } from "./types";

export function refillMarket(state: GameState, tier: 1 | 2 | 3): void {
  const rowKey = `tier${tier}` as const;
  const row = state.market[rowKey];
  const deck = state.decks[rowKey];
  for (let i = 0; i < GAME_RULES.marketVisiblePerTier; i += 1) {
    if (!row[i] && deck.length > 0) {
      row[i] = deck.shift() ?? null;
    }
  }
}

export function removeMarketCard(
  state: GameState,
  tier: 1 | 2 | 3,
  index: number,
): Card {
  const rowKey = `tier${tier}` as const;
  const card = state.market[rowKey][index];
  if (!card) {
    throw new Error("Market slot is empty");
  }
  state.market[rowKey][index] = null;
  refillMarket(state, tier);
  return card;
}

export function drawFromDeck(state: GameState, tier: 1 | 2 | 3): Card | null {
  const deck = state.decks[`tier${tier}`];
  return deck.shift() ?? null;
}
