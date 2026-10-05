import { bonuses } from "./helpers";
import type { GameState, GemType, Noble, PlayerState } from "./types";
import { GEM_TYPES } from "./types";

export function qualifiesForNoble(
  player: { cards: Array<{ bonus: GemType }> },
  noble: Noble,
): boolean {
  const bonus = bonuses(player);
  return GEM_TYPES.every((gem) => bonus[gem] >= (noble.requirement[gem] ?? 0));
}

/** Nobles on the table whose requirements the player's card bonuses meet. */
export function eligibleNobles(
  nobles: Noble[],
  player: { cards: Array<{ bonus: GemType }> },
): Noble[] {
  return nobles.filter((candidate) => qualifiesForNoble(player, candidate));
}

export function claimEligibleNobles(
  state: GameState,
  player: PlayerState,
  preferredId?: string,
): Noble[] {
  // Official rule: at most one noble visits per turn, and when several qualify the
  // player picks. Without a pick, the first eligible noble in table order comes;
  // the others stay on the table for later turns.
  const eligible = eligibleNobles(state.nobles, player);
  const noble = eligible.find((candidate) => candidate.id === preferredId) ?? eligible[0];
  if (!noble) {
    return [];
  }
  player.achievements.push(noble);
  state.nobles = state.nobles.filter((candidate) => candidate.id !== noble.id);
  return [noble];
}
