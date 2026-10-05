import { describe, expect, it } from "vitest";
import { applyAction, createGame, forfeitGame, skipTurn } from "../Game";
import { GAME_RULES } from "../rules/constants";
import { emptyTokens } from "../helpers";
import type { Card, GameState, GemType, Noble, PlayerState } from "../types";
import { GEM_TYPES } from "../types";
import { canAfford, suggestedPayment } from "../rules/payment";
import { bonuses } from "../helpers";
import { toClientView } from "../view";

const ruby: Card = {
  id: "test-ruby",
  name: "Test Ruby",
  tier: 1,
  points: 1,
  bonus: "RUBY",
  cost: { SAPPHIRE: 2, PEARL: 1 },
  artwork: "ruby-chip",
};

const sapphire: Card = {
  id: "test-sapphire",
  name: "Test Sapphire",
  tier: 1,
  points: 0,
  bonus: "SAPPHIRE",
  cost: { RUBY: 3 },
  artwork: "sapphire-chip",
};

const expensive: Card = {
  id: "test-crown",
  name: "Test Crown",
  tier: 3,
  points: 4,
  bonus: "ONYX",
  cost: { RUBY: 3, SAPPHIRE: 3, EMERALD: 3 },
  artwork: "onyx-crown",
};

const victoryCard: Card = {
  id: "test-victory",
  name: "Test Victory",
  tier: 3,
  points: 15,
  bonus: "ONYX",
  cost: { PEARL: 1 },
  artwork: "onyx-relic",
};

const nobleAurelia: Noble = {
  id: "aurelia",
  name: "Lady Aurelia",
  points: 3,
  requirement: { RUBY: 1, SAPPHIRE: 1 },
  portrait: "aurelia",
};

function makeCards(): Card[] {
  const filler = (tier: 1 | 2 | 3, n: number, bonus: GemType): Card => ({
    id: `filler-${tier}-${bonus}-${n}`,
    name: `Filler ${n}`,
    tier,
    points: 0,
    bonus,
    cost: { RUBY: 1 },
    artwork: "ruby-chip",
  });
  return [
    ruby,
    sapphire,
    expensive,
    victoryCard,
    ...Array.from({ length: 8 }, (_, i) => filler(1, i, "EMERALD")),
    ...Array.from({ length: 8 }, (_, i) => filler(2, i, "ONYX")),
    ...Array.from({ length: 8 }, (_, i) => filler(3, i, "PEARL")),
  ];
}

function startTwoPlayer(seed = 1): GameState {
  return createGame({
    id: "game-1",
    seed,
    cards: makeCards(),
    nobles: [nobleAurelia],
    players: [
      { id: "p1", name: "Player One", avatar: "crest-1" },
      { id: "p2", name: "Player Two", avatar: "crest-2" },
    ],
  });
}

function giveTokens(state: GameState, playerId: string, amounts: Partial<PlayerState["tokens"]>) {
  const player = state.players.find((entry) => entry.id === playerId)!;
  for (const [key, value] of Object.entries(amounts)) {
    player.tokens[key as GemType] = value ?? 0;
  }
}

describe("createGame", () => {
  it("starts a two-player table with a filled market and bank", () => {
    const state = startTwoPlayer();
    expect(state.status).toBe("PLAYING");
    expect(state.players).toHaveLength(2);
    expect(state.currentPlayerId).toBe("p1");
    expect(state.market.tier1.filter(Boolean)).toHaveLength(4);
    expect(state.bank.RUBY).toBe(GAME_RULES.bankTokensByPlayers[2].gem);
    expect(state.bank.ROYAL).toBe(5);
    expect(state.nobles).toHaveLength(1);
  });
});

describe("take tokens", () => {
  it("allows three different gems", () => {
    const state = startTwoPlayer();
    const result = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].tokens.RUBY).toBe(1);
    expect(result.state.bank.RUBY).toBe(state.bank.RUBY - 1);
    expect(result.state.currentPlayerId).toBe("p2");
    expect(result.events.some((event) => event.type === "TOKENS_TAKEN")).toBe(true);
  });

  it("rejects two different gems when three piles remain", () => {
    const state = startTwoPlayer();
    const result = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE"],
    });
    expect(result.ok).toBe(false);
  });

  it("allows two matching gems when the pile is deep enough", () => {
    const state = startTwoPlayer();
    const result = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "RUBY"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].tokens.RUBY).toBe(2);
  });

  it("rejects two matching gems when the pile is shallow", () => {
    const state = startTwoPlayer();
    state.bank.RUBY = 3;
    const result = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "RUBY"],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects taking royal gems", () => {
    const state = startTwoPlayer();
    const result = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "ROYAL" as GemType],
    });
    expect(result.ok).toBe(false);
  });

  it("requires a discard when the hand would exceed ten", () => {
    const state = startTwoPlayer();
    giveTokens(state, "p1", {
      RUBY: 2,
      SAPPHIRE: 2,
      EMERALD: 2,
      ONYX: 1,
      PEARL: 2,
      ROYAL: 0,
    });
    const withoutDiscard = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
    });
    expect(withoutDiscard.ok).toBe(false);

    const withDiscard = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
      discard: { RUBY: 2 },
    });
    expect(withDiscard.ok).toBe(true);
    if (!withDiscard.ok) return;
    const total = Object.values(withDiscard.state.players[0].tokens).reduce(
      (sum, n) => sum + n,
      0,
    );
    expect(total).toBe(10);
  });
});

describe("buy cards", () => {
  it("purchases a market card with exact gems and grants a bonus", () => {
    const state = startTwoPlayer();
    const target = state.market.tier1.find((card) => card?.id === ruby.id) ?? ruby;
    if (!state.market.tier1.some((card) => card?.id === ruby.id)) {
      state.market.tier1[0] = ruby;
    }
    giveTokens(state, "p1", { SAPPHIRE: 2, PEARL: 1 });
    const result = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: target.id,
      payment: { SAPPHIRE: 2, PEARL: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].cards[0].id).toBe(ruby.id);
    expect(bonuses(result.state.players[0]).RUBY).toBe(1);
    expect(result.state.players[0].points).toBe(1);
    expect(result.state.players[0].tokens.SAPPHIRE).toBe(0);
  });

  it("applies permanent discounts and royal fill", () => {
    const state = startTwoPlayer();
    state.market.tier1[0] = expensive;
    state.players[0].cards.push({
      ...ruby,
      id: "owned-ruby",
    });
    state.players[0].cards.push({
      ...sapphire,
      id: "owned-sapphire",
    });
    giveTokens(state, "p1", { RUBY: 2, SAPPHIRE: 2, EMERALD: 2, ROYAL: 1 });
    const payment = suggestedPayment(state.players[0], expensive.cost);
    expect(payment).not.toBeNull();
    const result = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: expensive.id,
      payment: payment!,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a purchase with insufficient resources", () => {
    const state = startTwoPlayer();
    state.market.tier1[0] = ruby;
    const result = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: ruby.id,
      payment: { SAPPHIRE: 2, PEARL: 1 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toContain("need");
  });

  it("rejects acting off-turn", () => {
    const state = startTwoPlayer();
    const result = applyAction(state, "p2", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("It is not your turn.");
  });
});

describe("reserve cards", () => {
  it("moves a market card into the reserved area and grants royal", () => {
    const state = startTwoPlayer();
    const card = state.market.tier1.find(Boolean)!;
    const result = applyAction(state, "p1", {
      type: "RESERVE_CARD",
      cardId: card.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].reservedCards[0].id).toBe(card.id);
    expect(result.state.players[0].tokens.ROYAL).toBe(1);
    expect(result.state.bank.ROYAL).toBe(4);
  });

  it("enforces the reservation limit", () => {
    const state = startTwoPlayer();
    state.players[0].reservedCards = [ruby, sapphire, expensive];
    const card = state.market.tier2.find(Boolean)!;
    const result = applyAction(state, "p1", {
      type: "RESERVE_CARD",
      cardId: card.id,
    });
    expect(result.ok).toBe(false);
  });

  it("allows buying a reserved card", () => {
    const state = startTwoPlayer();
    state.players[0].reservedCards = [{ ...ruby }];
    giveTokens(state, "p1", { SAPPHIRE: 2, PEARL: 1 });
    const result = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: ruby.id,
      payment: { SAPPHIRE: 2, PEARL: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].reservedCards).toHaveLength(0);
    expect(result.state.players[0].cards[0].id).toBe(ruby.id);
  });
});

describe("achievements and victory", () => {
  it("claims a noble when bonuses match", () => {
    const state = startTwoPlayer();
    state.market.tier1[0] = ruby;
    state.players[0].cards.push({
      ...sapphire,
      id: "owned-s",
    });
    giveTokens(state, "p1", { SAPPHIRE: 1, PEARL: 1 });
    const result = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: ruby.id,
      payment: { SAPPHIRE: 1, PEARL: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].achievements[0]?.id).toBe("aurelia");
    expect(result.state.players[0].points).toBe(1 + 3);
    expect(result.events.some((event) => event.type === "ACHIEVEMENT_CLAIMED")).toBe(
      true,
    );
  });

  it("finishes the round after a player reaches victory points", () => {
    const state = startTwoPlayer();
    state.market.tier1[0] = victoryCard;
    giveTokens(state, "p1", { PEARL: 1 });
    const first = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: victoryCard.id,
      payment: { PEARL: 1 },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.endgameTriggered).toBe(true);
    expect(first.state.status).toBe("PLAYING");
    expect(first.state.currentPlayerId).toBe("p2");

    const second = applyAction(first.state, "p2", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.status).toBe("FINISHED");
    expect(second.state.winnerId).toBe("p1");
  });
});

describe("affordability helpers", () => {
  it("reports whether a player can afford a card", () => {
    const player: PlayerState = {
      id: "p1",
      name: "Player One",
      avatar: "crest-1",
      tokens: { ...emptyTokens(), SAPPHIRE: 2, PEARL: 1 },
      cards: [],
      reservedCards: [],
      achievements: [],
      points: 0,
    };
    expect(canAfford(player, ruby.cost)).toBe(true);
    expect(canAfford(player, expensive.cost)).toBe(false);
    expect(suggestedPayment(player, ruby.cost)).toEqual({
      SAPPHIRE: 2,
      PEARL: 1,
    });
  });

  it("keeps gem type lists complete", () => {
    expect(GEM_TYPES).toHaveLength(5);
  });
});

describe("review regressions", () => {
  it("rejects returning more gems than needed to get back to ten", () => {
    const state = startTwoPlayer();
    giveTokens(state, "p1", { RUBY: 2, SAPPHIRE: 2, EMERALD: 2, PEARL: 2, ONYX: 1 });
    const tooMany = applyAction(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
      discard: { RUBY: 2, PEARL: 2, ONYX: 1 },
    });
    expect(tooMany.ok).toBe(false);
  });

  it("keeps a blind deck reserve secret from other players", () => {
    const state = startTwoPlayer();
    const result = applyAction(state, "p1", { type: "RESERVE_CARD", deckTier: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.events.find((entry) => entry.type === "CARD_RESERVED");
    expect(event && "cardId" in event ? event.cardId : undefined).toBeUndefined();

    const opponentView = toClientView(result.state, "p2");
    const hidden = opponentView.players.find((player) => player.id === "p1")!.reservedCards[0];
    expect(hidden.id).toBe("p1-hidden-0");
    expect(JSON.stringify(opponentView)).not.toContain(result.state.players[0].reservedCards[0].id);
  });

  it("lets only one noble visit per turn", () => {
    const twin = (id: string): Noble => ({
      id,
      name: id,
      points: 3,
      requirement: { RUBY: 1 },
      portrait: "aurelia",
    });
    const state = createGame({
      id: "game-nobles",
      seed: 1,
      cards: makeCards(),
      nobles: [twin("n1"), twin("n2")],
      players: [
        { id: "p1", name: "Player One", avatar: "crest-1" },
        { id: "p2", name: "Player Two", avatar: "crest-2" },
      ],
    });
    state.market.tier1[0] = ruby;
    giveTokens(state, "p1", { SAPPHIRE: 2, PEARL: 1 });
    const bought = applyAction(state, "p1", {
      type: "BUY_CARD",
      cardId: ruby.id,
      payment: { SAPPHIRE: 2, PEARL: 1 },
    });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.players[0].achievements).toHaveLength(1);
    expect(bought.state.nobles).toHaveLength(1);
  });
});

describe("absent players and public reserves", () => {
  it("shows market reserves to opponents but hides blind deck reserves", () => {
    const state = startTwoPlayer();
    const marketCard = state.market.tier1.find(Boolean)!;
    const first = applyAction(state, "p1", { type: "RESERVE_CARD", cardId: marketCard.id });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyAction(first.state, "p2", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
    });
    if (!second.ok) throw new Error(second.error);
    const third = applyAction(second.state, "p1", { type: "RESERVE_CARD", deckTier: 2 });
    if (!third.ok) throw new Error(third.error);

    const seen = toClientView(third.state, "p2").players.find((p) => p.id === "p1")!;
    expect(seen.reservedCards[0].id).toBe(marketCard.id);
    expect("hidden" in seen.reservedCards[1]).toBe(true);
    expect("blindReserveIds" in seen).toBe(false);
  });

  it("skips the turn of a player who left", () => {
    const state = startTwoPlayer();
    const result = skipTurn(state, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentPlayerId).toBe("p2");
    expect(result.events[0]).toEqual({ type: "TURN_SKIPPED", playerId: "p1" });
    expect(skipTurn(state, "p2").ok).toBe(false);
  });

  it("awards the game to the last player at the table", () => {
    const result = forfeitGame(startTwoPlayer(), "p2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("FINISHED");
    expect(result.state.winnerId).toBe("p2");
  });
});

describe("spectator view", () => {
  it("shows public information but no blind reserves for someone without a seat", () => {
    const state = startTwoPlayer();
    const marketCard = state.market.tier1.find(Boolean)!;
    const first = applyAction(state, "p1", { type: "RESERVE_CARD", cardId: marketCard.id });
    if (!first.ok) throw new Error(first.error);
    const second = applyAction(first.state, "p2", { type: "RESERVE_CARD", deckTier: 2 });
    if (!second.ok) throw new Error(second.error);

    const view = toClientView(second.state, "__spectator__");
    const [p1, p2] = view.players;
    expect(p1.reservedCards[0].id).toBe(marketCard.id);
    expect("hidden" in p2.reservedCards[0]).toBe(true);
    expect(JSON.stringify(view)).not.toContain(second.state.players[1].reservedCards[0].id);
  });
});
