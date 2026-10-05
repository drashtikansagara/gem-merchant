import { GAME_RULES } from "../rules/constants";
import type { GameEvent, GameState, ReserveCardAction } from "../types";
import { getPlayer } from "../helpers";
import { drawFromDeck, removeMarketCard } from "../Card";
import { findMarketCard } from "../helpers";
import { addTokens } from "../Player";
import { takeFromBank } from "../Token";
import { returnDiscard } from "./takeTokens";

export function applyReserveCard(
  state: GameState,
  playerId: string,
  action: ReserveCardAction,
  events: GameEvent[],
): void {
  const player = getPlayer(state, playerId);
  let card =
    action.deckTier != null ? drawFromDeck(state, action.deckTier) : null;
  const fromDeck = card != null;

  if (!card && action.cardId) {
    const market = findMarketCard(state, action.cardId);
    if (market) {
      card = removeMarketCard(state, market.tier, market.index);
    }
  }

  if (!card) {
    throw new Error("Card not found");
  }

  player.reservedCards.push(card);
  if (fromDeck) {
    player.blindReserveIds = [...(player.blindReserveIds ?? []), card.id];
  }

  let gainedRoyal = false;
  if (GAME_RULES.royalOnReserve && state.bank.ROYAL > 0) {
    takeFromBank(state, { ROYAL: 1 });
    addTokens(player, { ROYAL: 1 });
    gainedRoyal = true;
  }

  events.push({
    type: "CARD_RESERVED",
    playerId,
    // A deck reserve is secret: don't broadcast which card was drawn.
    ...(fromDeck ? { deckTier: action.deckTier } : { cardId: card.id }),
    gainedRoyal,
  });
  returnDiscard(state, playerId, action.discard, events);
}
