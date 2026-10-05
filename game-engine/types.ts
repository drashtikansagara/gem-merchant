export const GEM_TYPES = [
  "RUBY",
  "SAPPHIRE",
  "EMERALD",
  "ONYX",
  "PEARL",
] as const;

export const RESOURCE_TYPES = [...GEM_TYPES, "ROYAL"] as const;

export type GemType = (typeof GEM_TYPES)[number];
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface Card {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  points: number;
  bonus: GemType;
  cost: Partial<Record<GemType, number>>;
  artwork: string;
}

export interface HiddenCard {
  id: string;
  hidden: true;
}

export interface Noble {
  id: string;
  name: string;
  points: number;
  requirement: Partial<Record<GemType, number>>;
  portrait: string;
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: string;
  tokens: Record<ResourceType, number>;
  cards: Card[];
  reservedCards: Card[];
  /**
   * Ids of reserved cards drawn blind from a deck; only these are hidden from
   * opponents (market reserves are public, as in the tabletop game). Missing on
   * games saved before this field existed: then every reserve stays hidden.
   */
  blindReserveIds?: string[];
  achievements: Noble[];
  points: number;
}

export interface ClientPlayerState extends Omit<PlayerState, "reservedCards"> {
  reservedCards: Array<Card | HiddenCard>;
}

export type GameStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface GameState {
  id: string;
  status: GameStatus;
  players: PlayerState[];
  currentPlayerId: string;
  market: {
    tier1: Array<Card | null>;
    tier2: Array<Card | null>;
    tier3: Array<Card | null>;
  };
  decks: {
    tier1: Card[];
    tier2: Card[];
    tier3: Card[];
  };
  nobles: Noble[];
  bank: Record<ResourceType, number>;
  turnNumber: number;
  winnerId?: string;
  endgameTriggered: boolean;
  /** The game ended because the other players left, not on points. */
  endedByForfeit?: boolean;
  log: GameLogEntry[];
}

export interface ClientGameState
  extends Omit<GameState, "players" | "decks"> {
  players: ClientPlayerState[];
  deckCounts: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

export interface GameLogEntry {
  id: string;
  message: string;
  turnNumber: number;
}

/**
 * Every action may name the noble to receive when the turn ends with the player
 * qualifying for more than one: the official rule lets the player choose. When
 * omitted, the first eligible noble in table order visits.
 */
interface NobleChoice {
  nobleId?: string;
}

export type TakeTokensAction = NobleChoice & {
  type: "TAKE_TOKENS";
  tokens: GemType[];
  discard?: Partial<Record<ResourceType, number>>;
};

export type BuyCardAction = NobleChoice & {
  type: "BUY_CARD";
  cardId: string;
  payment: Partial<Record<ResourceType, number>>;
};

export type ReserveCardAction = NobleChoice & {
  type: "RESERVE_CARD";
  cardId?: string;
  deckTier?: 1 | 2 | 3;
  /** Tokens to hand back when the gold Royal would take the hand past the limit. */
  discard?: Partial<Record<ResourceType, number>>;
};

/** Only legal when the player has no other legal action, so the game can't stall. */
export type PassAction = NobleChoice & {
  type: "PASS";
};

export type GameAction = TakeTokensAction | BuyCardAction | ReserveCardAction | PassAction;

export type GameEvent =
  | { type: "TOKENS_TAKEN"; playerId: string; tokens: GemType[] }
  | {
      type: "TOKENS_RETURNED";
      playerId: string;
      tokens: Partial<Record<ResourceType, number>>;
    }
  | { type: "CARD_PURCHASED"; playerId: string; cardId: string; points: number }
  | {
      type: "CARD_RESERVED";
      playerId: string;
      /** Omitted for blind reserves from a deck: events go to every player. */
      cardId?: string;
      /** Tier of the deck the card was drawn from, for blind reserves. */
      deckTier?: 1 | 2 | 3;
      gainedRoyal: boolean;
    }
  | {
      type: "ACHIEVEMENT_CLAIMED";
      playerId: string;
      achievementId: string;
      points: number;
    }
  | { type: "TURN_CHANGED"; playerId: string; turnNumber: number }
  /** The player left the table, so their turn was passed. */
  | { type: "TURN_SKIPPED"; playerId: string }
  /** The player had no legal action and passed. */
  | { type: "TURN_PASSED"; playerId: string }
  /** Everyone else left; the remaining player wins by forfeit. */
  | { type: "GAME_FORFEITED"; winnerId: string }
  | { type: "GAME_FINISHED"; winnerId: string };

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };
