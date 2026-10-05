import type { Card, HiddenCard } from "./types";

export function isHiddenCard(card: Card | HiddenCard): card is HiddenCard {
  return "hidden" in card && card.hidden === true;
}
