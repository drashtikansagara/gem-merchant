import { GAME_RULES } from "./rules/constants";
import type { GameState, GemType, ResourceType } from "./types";
import { GEM_TYPES } from "./types";
import { emptyTokens } from "./helpers";

export function startingBank(playerCount: number): Record<ResourceType, number> {
  const amounts =
    GAME_RULES.bankTokensByPlayers[playerCount] ??
    GAME_RULES.bankTokensByPlayers[4];
  const bank = emptyTokens();
  for (const gem of GEM_TYPES) {
    bank[gem] = amounts.gem;
  }
  bank.ROYAL = amounts.royal;
  return bank;
}

export function takeFromBank(
  state: GameState,
  tokens: Partial<Record<ResourceType, number>>,
): void {
  for (const [type, amount] of Object.entries(tokens) as Array<
    [ResourceType, number]
  >) {
    state.bank[type] -= amount;
  }
}

export function returnToBank(
  state: GameState,
  tokens: Partial<Record<ResourceType, number>>,
): void {
  for (const [type, amount] of Object.entries(tokens) as Array<
    [ResourceType, number]
  >) {
    state.bank[type] += amount;
  }
}

export function canTakeSame(bank: Record<ResourceType, number>, gem: GemType): boolean {
  return bank[gem] >= GAME_RULES.takeSameMinBank;
}
