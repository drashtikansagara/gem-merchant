import type { BuyCardAction, GameEvent, GameState } from "../types";
import { findMarketCard, findReservedCard, getPlayer } from "../helpers";
import { removeTokens } from "../Player";
import { returnToBank } from "../Token";
import { removeMarketCard } from "../Card";

export function applyBuyCard(
  state: GameState,
  playerId: string,
  action: BuyCardAction,
  events: GameEvent[],
): void {
  const player = getPlayer(state, playerId);
  const market = findMarketCard(state, action.cardId);
  const reserved = findReservedCard(player, action.cardId);
  const card = market?.card ?? reserved?.card;
  if (!card) {
    throw new Error("Card not found");
  }

  removeTokens(player, action.payment);
  returnToBank(state, action.payment);

  if (market) {
    removeMarketCard(state, market.tier, market.index);
  } else if (reserved) {
    player.reservedCards.splice(reserved.index, 1);
    player.blindReserveIds = player.blindReserveIds?.filter((id) => id !== action.cardId);
  }

  player.cards.push(card);
  events.push({
    type: "CARD_PURCHASED",
    playerId,
    cardId: card.id,
    points: card.points,
  });
}
