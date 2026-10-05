import { GAME_RULES } from "./constants";
import type { ClientPlayerState, GameAction, GameState } from "../types";
import { isHiddenCard } from "../hidden";
import {
  bankColorsAvailable,
  findMarketCard,
  findReservedCard,
  getPlayer,
  totalTokens,
} from "../helpers";
import { canAfford, missingGemsMessage, validatePayment } from "./payment";
import { validateDiscard, validateTakeTokens } from "./tokens";

export function validateAction(
  state: GameState,
  playerId: string,
  action: GameAction,
): string | null {
  if (state.status !== "PLAYING") {
    return "The game is not in progress.";
  }

  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return "Player not found.";
  }

  if (state.currentPlayerId !== playerId) {
    return "It is not your turn.";
  }

  switch (action.type) {
    case "TAKE_TOKENS": {
      const takeError = validateTakeTokens(state, action, totalTokens(player.tokens));
      if (takeError) {
        return takeError;
      }
      return validateDiscard(player.tokens, action.tokens, action.discard);
    }
    case "BUY_CARD": {
      const market = findMarketCard(state, action.cardId);
      const reserved = findReservedCard(player, action.cardId);
      const card = market?.card ?? reserved?.card;
      if (!card) {
        return "That card is no longer available.";
      }
      const paymentError = validatePayment(player, card.cost, action.payment);
      if (paymentError) {
        if (paymentError === "You do not have those gems.") {
          return missingGemsMessage(player, card.cost);
        }
        return paymentError;
      }
      return null;
    }
    case "RESERVE_CARD": {
      if (player.reservedCards.length >= GAME_RULES.maxReservedCards) {
        return "You already have three reserved cards.";
      }
      if (action.deckTier) {
        const deck = state.decks[`tier${action.deckTier}`];
        if (!deck || deck.length === 0) {
          return "That card is no longer available.";
        }
      } else if (!action.cardId || !findMarketCard(state, action.cardId)) {
        return "That card is no longer available.";
      }
      // The gold Royal counts toward the hand limit like any other token.
      const gained = GAME_RULES.royalOnReserve && state.bank.ROYAL > 0 ? (["ROYAL"] as const) : [];
      return validateDiscard(player.tokens, [...gained], action.discard);
    }
    case "PASS": {
      const inDecks = state.decks.tier1.length + state.decks.tier2.length + state.decks.tier3.length;
      return hasLegalAction(state, player, inDecks) ? "You still have a legal move." : null;
    }
    default:
      return "Unknown action.";
  }
}

/**
 * Whether the player can take, reserve or buy anything. Taking is always legal
 * while any gem is in the bank, since extras can be handed back. Takes the
 * client view's shape too, so the table can offer Pass only when it is legal.
 */
export function hasLegalAction(
  state: Pick<GameState, "bank" | "market">,
  player: Pick<ClientPlayerState, "tokens" | "cards" | "reservedCards">,
  cardsInDecks: number,
): boolean {
  const takeBlocked =
    GAME_RULES.blockTakeAtHandLimit && totalTokens(player.tokens) >= GAME_RULES.maxTokensInHand;
  if (!takeBlocked && bankColorsAvailable(state.bank) > 0) {
    return true;
  }
  const market = [...state.market.tier1, ...state.market.tier2, ...state.market.tier3];
  const canReserve =
    player.reservedCards.length < GAME_RULES.maxReservedCards &&
    (market.some((card) => card != null) || cardsInDecks > 0);
  if (canReserve) {
    return true;
  }
  return [...market, ...player.reservedCards].some(
    (card) => card != null && !isHiddenCard(card) && canAfford(player, card.cost),
  );
}

export { missingGemsMessage };
export function wouldExceedTokenLimit(
  state: GameState,
  playerId: string,
  takenCount: number,
): boolean {
  const player = getPlayer(state, playerId);
  return totalTokens(player.tokens) + takenCount > GAME_RULES.maxTokensInHand;
}
