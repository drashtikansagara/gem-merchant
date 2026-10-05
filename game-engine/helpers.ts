import {
  GEM_TYPES,
  RESOURCE_TYPES,
  type Card,
  type GameState,
  type GemType,
  type PlayerState,
  type ResourceType,
} from "./types";

export function emptyTokens(): Record<ResourceType, number> {
  return {
    RUBY: 0,
    SAPPHIRE: 0,
    EMERALD: 0,
    ONYX: 0,
    PEARL: 0,
    ROYAL: 0,
  };
}

export function cloneState<T>(value: T): T {
  return structuredClone(value);
}

export function getPlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  return player;
}

export function playerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex((entry) => entry.id === playerId);
}

export function totalTokens(tokens: Record<ResourceType, number>): number {
  return RESOURCE_TYPES.reduce((sum, type) => sum + tokens[type], 0);
}

export function bonuses(player: { cards: Array<{ bonus: GemType }> }): Record<GemType, number> {
  const counts = {
    RUBY: 0,
    SAPPHIRE: 0,
    EMERALD: 0,
    ONYX: 0,
    PEARL: 0,
  } satisfies Record<GemType, number>;
  for (const card of player.cards) {
    counts[card.bonus] += 1;
  }
  return counts;
}

export function remainingCost(
  player: { cards: Array<{ bonus: GemType }> },
  cost: Partial<Record<GemType, number>>,
): Record<GemType, number> {
  const bonus = bonuses(player);
  const remaining = {
    RUBY: 0,
    SAPPHIRE: 0,
    EMERALD: 0,
    ONYX: 0,
    PEARL: 0,
  } satisfies Record<GemType, number>;
  for (const gem of GEM_TYPES) {
    remaining[gem] = Math.max(0, (cost[gem] ?? 0) - bonus[gem]);
  }
  return remaining;
}

export function remainingCostTotal(remaining: Record<GemType, number>): number {
  return GEM_TYPES.reduce((sum, gem) => sum + remaining[gem], 0);
}

export function paymentTotal(
  payment: Partial<Record<ResourceType, number>>,
): number {
  return RESOURCE_TYPES.reduce((sum, type) => sum + (payment[type] ?? 0), 0);
}

export function countTokens(list: GemType[]): Record<GemType, number> {
  const counts = {
    RUBY: 0,
    SAPPHIRE: 0,
    EMERALD: 0,
    ONYX: 0,
    PEARL: 0,
  } satisfies Record<GemType, number>;
  for (const gem of list) {
    counts[gem] += 1;
  }
  return counts;
}

export function bankColorsAvailable(bank: Record<ResourceType, number>): number {
  return GEM_TYPES.filter((gem) => bank[gem] > 0).length;
}

export function findMarketCard(
  state: GameState,
  cardId: string,
): { card: Card; tier: 1 | 2 | 3; index: number } | null {
  const rows = [
    { tier: 1 as const, row: state.market.tier1 },
    { tier: 2 as const, row: state.market.tier2 },
    { tier: 3 as const, row: state.market.tier3 },
  ];
  for (const { tier, row } of rows) {
    const index = row.findIndex((card) => card?.id === cardId);
    if (index >= 0 && row[index]) {
      return { card: row[index], tier, index };
    }
  }
  return null;
}

export function findReservedCard(
  player: PlayerState,
  cardId: string,
): { card: Card; index: number } | null {
  const index = player.reservedCards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    return null;
  }
  return { card: player.reservedCards[index], index };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextLogId(state: GameState): string {
  return `log-${state.log.length + 1}-${state.turnNumber}`;
}
