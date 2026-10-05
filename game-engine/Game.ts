import { CARD_CATALOG } from "@/game-data/cards";
import { ACHIEVEMENT_CATALOG } from "@/game-data/achievements";
import { RESOURCE_META } from "@/game-data/resources";
import { applyBuyCard } from "./actions/buyCard";
import { applyReserveCard } from "./actions/reserveCard";
import { applyTakeTokens } from "./actions/takeTokens";
import { gameFinished, turnChanged } from "./events/events";
import {
  cloneState,
  emptyTokens,
  getPlayer,
  mulberry32,
  nextLogId,
  playerIndex,
  shuffle,
} from "./helpers";
import { claimEligibleNobles, qualifiesForNoble } from "./Noble";
import { GAME_RULES } from "./rules/constants";
import { computeScore } from "./rules/scoring";
import { validateAction } from "./rules/validation";
import { determineWinner, shouldEndGame } from "./rules/victory";
import { startingBank } from "./Token";
import type {
  ApplyResult,
  Card,
  GameAction,
  GameEvent,
  GameState,
  Noble,
} from "./types";
import { refillMarket } from "./Card";

export interface CreateGameInput {
  id: string;
  players: Array<{ id: string; name: string; avatar: string }>;
  cards?: Card[];
  nobles?: Noble[];
  rng?: () => number;
  seed?: number;
}

function logFromEvent(state: GameState, event: GameEvent): string {
  const player = state.players.find((entry) =>
    "playerId" in event ? entry.id === event.playerId : false,
  );
  const name = player?.name ?? "A player";

  switch (event.type) {
    case "TOKENS_TAKEN": {
      const labels = event.tokens.map((gem) => RESOURCE_META[gem].name);
      return `${name} gained ${labels.length} gem${labels.length === 1 ? "" : "s"}`;
    }
    case "TOKENS_RETURNED":
      return `${name} returned gems to the bank`;
    case "CARD_PURCHASED": {
      const card = player?.cards.find((entry) => entry.id === event.cardId);
      return `${name} bought ${card?.name ?? "a development"}`;
    }
    case "CARD_RESERVED":
      return `${name} reserved a card`;
    case "ACHIEVEMENT_CLAIMED": {
      const noble = player?.achievements.find(
        (entry) => entry.id === event.achievementId,
      );
      return `${name} claimed ${noble?.name ?? "an achievement"}`;
    }
    case "TURN_CHANGED":
      return `${name}'s turn`;
    case "GAME_FINISHED":
      return "The market is closed";
    case "TURN_PASSED":
      return `${name} had no legal move and passed`;
    case "TURN_SKIPPED":
      return `${name} has left the table — turn skipped`;
    case "GAME_FORFEITED":
      return `${name} wins: the other merchants left`;
    default:
      return "";
  }
}

function appendLogs(state: GameState, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === "TURN_CHANGED") {
      continue;
    }
    const message = logFromEvent(state, event);
    if (message) {
      state.log.push({
        id: nextLogId(state),
        message,
        turnNumber: state.turnNumber,
      });
    }
  }
}

export function createGame(input: CreateGameInput): GameState {
  const playerCount = input.players.length;
  if (
    playerCount < GAME_RULES.minimumPlayers ||
    playerCount > GAME_RULES.maximumPlayers
  ) {
    throw new Error("Invalid player count");
  }

  const rng = input.rng ?? (input.seed != null ? mulberry32(input.seed) : Math.random);
  const catalog = input.cards ?? CARD_CATALOG;
  const noblePool = input.nobles ?? ACHIEVEMENT_CATALOG;
  const nobleCount = GAME_RULES.noblesCountByPlayers[playerCount] ?? 3;

  const tier1 = shuffle(
    catalog.filter((card) => card.tier === 1),
    rng,
  );
  const tier2 = shuffle(
    catalog.filter((card) => card.tier === 2),
    rng,
  );
  const tier3 = shuffle(
    catalog.filter((card) => card.tier === 3),
    rng,
  );
  const nobles = shuffle([...noblePool], rng).slice(0, nobleCount);

  const state: GameState = {
    id: input.id,
    status: "PLAYING",
    players: input.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      tokens: emptyTokens(),
      cards: [],
      reservedCards: [],
      blindReserveIds: [],
      achievements: [],
      points: 0,
    })),
    currentPlayerId: input.players[0].id,
    market: {
      tier1: Array.from({ length: GAME_RULES.marketVisiblePerTier }, () => null),
      tier2: Array.from({ length: GAME_RULES.marketVisiblePerTier }, () => null),
      tier3: Array.from({ length: GAME_RULES.marketVisiblePerTier }, () => null),
    },
    decks: { tier1, tier2, tier3 },
    nobles,
    bank: startingBank(playerCount),
    turnNumber: 1,
    endgameTriggered: false,
    log: [],
  };

  refillMarket(state, 1);
  refillMarket(state, 2);
  refillMarket(state, 3);
  return state;
}

function advanceTurn(state: GameState, events: GameEvent[]): void {
  const index = playerIndex(state, state.currentPlayerId);
  const nextIndex = (index + 1) % state.players.length;
  if (nextIndex === 0) {
    state.turnNumber += 1;
  }
  state.currentPlayerId = state.players[nextIndex].id;
  events.push(turnChanged(state.currentPlayerId, state.turnNumber));
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: GameAction,
): ApplyResult {
  const error = validateAction(state, playerId, action);
  if (error) {
    return { ok: false, error };
  }

  const next = cloneState(state);
  const events: GameEvent[] = [];

  switch (action.type) {
    case "TAKE_TOKENS":
      applyTakeTokens(next, playerId, action, events);
      break;
    case "BUY_CARD":
      applyBuyCard(next, playerId, action, events);
      break;
    case "RESERVE_CARD":
      applyReserveCard(next, playerId, action, events);
      break;
    case "PASS":
      events.push({ type: "TURN_PASSED", playerId });
      break;
  }

  const player = getPlayer(next, playerId);
  if (action.nobleId != null) {
    const chosen = next.nobles.find((noble) => noble.id === action.nobleId);
    if (!chosen || !qualifiesForNoble(player, chosen)) {
      return { ok: false, error: "That patron cannot join you this turn." };
    }
  }
  const claimed = claimEligibleNobles(next, player, action.nobleId);
  for (const noble of claimed) {
    events.push({
      type: "ACHIEVEMENT_CLAIMED",
      playerId,
      achievementId: noble.id,
      points: noble.points,
    });
  }

  player.points = computeScore(player);
  if (player.points >= GAME_RULES.victoryPoints) {
    next.endgameTriggered = true;
  }

  appendLogs(next, events);

  if (shouldEndGame(next, playerId)) {
    next.status = "FINISHED";
    next.winnerId = determineWinner(next);
    events.push(gameFinished(next.winnerId));
    appendLogs(next, [events[events.length - 1]]);
  } else {
    advanceTurn(next, events);
  }

  return { ok: true, state: next, events };
}

/** Pass the current turn of a player who has left the table. */
export function skipTurn(state: GameState, playerId: string): ApplyResult {
  if (state.status !== "PLAYING" || state.currentPlayerId !== playerId) {
    return { ok: false, error: "It is not that player's turn." };
  }
  const next = cloneState(state);
  const events: GameEvent[] = [{ type: "TURN_SKIPPED", playerId }];
  appendLogs(next, events);
  if (shouldEndGame(next, playerId)) {
    next.status = "FINISHED";
    next.winnerId = determineWinner(next);
    events.push(gameFinished(next.winnerId));
    appendLogs(next, [events[events.length - 1]]);
  } else {
    advanceTurn(next, events);
  }
  return { ok: true, state: next, events };
}

/**
 * End the game because too few players remain. `winnerId` is the last player
 * still seated; with nobody left, the usual scoring decides.
 */
export function forfeitGame(state: GameState, winnerId: string | null): ApplyResult {
  if (state.status !== "PLAYING") {
    return { ok: false, error: "The game is not in progress." };
  }
  const next = cloneState(state);
  next.status = "FINISHED";
  next.winnerId = winnerId ?? determineWinner(next);
  next.endedByForfeit = winnerId != null;
  const events: GameEvent[] = [];
  if (winnerId) {
    events.push({ type: "GAME_FORFEITED", winnerId });
  }
  events.push(gameFinished(next.winnerId));
  appendLogs(next, events);
  return { ok: true, state: next, events };
}

export function validateActionForPlayer(
  state: GameState,
  playerId: string,
  action: GameAction,
): string | null {
  return validateAction(state, playerId, action);
}
