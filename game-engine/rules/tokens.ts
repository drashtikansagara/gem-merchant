import { GAME_RULES } from "../rules/constants";
import type { GameState, ResourceType, TakeTokensAction } from "../types";
import { GEM_TYPES } from "../types";
import { bankColorsAvailable, countTokens } from "../helpers";
import { canTakeSame } from "../Token";
import { isTokenCounts } from "./payment";

export function validateTakeTokens(
  state: GameState,
  action: TakeTokensAction,
  handSize = 0,
): string | null {
  if (GAME_RULES.blockTakeAtHandLimit && handSize >= GAME_RULES.maxTokensInHand) {
    return `You already hold ${GAME_RULES.maxTokensInHand} gems. Buy or reserve a card instead.`;
  }
  const tokens = action.tokens;
  if (tokens.length === 0) {
    return "Choose a valid token combination.";
  }
  if (tokens.some((token) => !GEM_TYPES.includes(token))) {
    return "Choose a valid token combination.";
  }

  const counts = countTokens(tokens);
  const unique = GEM_TYPES.filter((gem) => counts[gem] > 0);
  const sameTake = unique.length === 1 && counts[unique[0]] === GAME_RULES.takeSameTokens;
  const differentTake = unique.every((gem) => counts[gem] === 1);

  if (sameTake) {
    const gem = unique[0];
    if (!canTakeSame(state.bank, gem)) {
      return "Two matching gems require a deep bank pile.";
    }
  } else if (differentTake) {
    const available = bankColorsAvailable(state.bank);
    const expected = Math.min(GAME_RULES.takeDifferentTokens, available);
    if (expected === 0) {
      return "The bank has no gems to take.";
    }
    if (tokens.length !== expected) {
      return "Choose a valid token combination.";
    }
    for (const gem of unique) {
      if (state.bank[gem] <= 0) {
        return "That gem is no longer in the bank.";
      }
    }
  } else {
    return "Choose a valid token combination.";
  }

  return null;
}

export function validateDiscard(
  playerTokens: Record<string, number>,
  taken: ResourceType[],
  discard: Partial<Record<string, number>> | undefined,
): string | null {
  if (discard && !isTokenCounts(discard)) {
    return "You cannot return gems you do not have.";
  }
  const next = { ...playerTokens };
  for (const gem of taken) {
    next[gem] += 1;
  }
  const totalAfterTake = Object.values(next).reduce((sum, n) => sum + n, 0);
  const discardEntries = Object.entries(discard ?? {}).filter(([, n]) => (n ?? 0) > 0);

  if (totalAfterTake <= GAME_RULES.maxTokensInHand) {
    if (discardEntries.length > 0) {
      return "You are not over the resource limit.";
    }
    return null;
  }

  if (discardEntries.length === 0) {
    return `Resources ${totalAfterTake} / ${GAME_RULES.maxTokensInHand}. Return gems to the bank.`;
  }

  let discardTotal = 0;
  for (const [type, amount] of discardEntries) {
    if ((amount ?? 0) < 0 || (next[type] ?? 0) < (amount ?? 0)) {
      return "You cannot return gems you do not have.";
    }
    discardTotal += amount ?? 0;
  }

  const finalTotal = totalAfterTake - discardTotal;
  if (finalTotal > GAME_RULES.maxTokensInHand) {
    return `Resources ${finalTotal} / ${GAME_RULES.maxTokensInHand}. Return gems to the bank.`;
  }
  if (finalTotal < GAME_RULES.maxTokensInHand) {
    return `Return only enough gems to get back to ${GAME_RULES.maxTokensInHand}.`;
  }
  if (finalTotal < 0) {
    return "You cannot return gems you do not have.";
  }
  return null;
}
