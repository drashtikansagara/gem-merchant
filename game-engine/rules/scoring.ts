import type { PlayerState } from "../types";

export function computeScore(player: PlayerState): number {
  const fromCards = player.cards.reduce((sum, card) => sum + card.points, 0);
  const fromNobles = player.achievements.reduce(
    (sum, noble) => sum + noble.points,
    0,
  );
  return fromCards + fromNobles;
}
