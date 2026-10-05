import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_CATALOG } from "@/game-data/achievements";
import { CARD_CATALOG } from "@/game-data/cards";
import { applyAction, createGame, skipTurn } from "../Game";
import { emptyTokens, totalTokens } from "../helpers";
import { GAME_RULES } from "../rules/constants";
import { hasLegalAction } from "../rules/validation";
import type { Card, GameAction, GameState, GemType, Noble, ResourceType } from "../types";
import { GEM_TYPES } from "../types";
import { toClientView } from "../view";

function start(playerCount = 2, seed = 7): GameState {
  return createGame({
    id: "rules",
    seed,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      avatar: `crest-${i + 1}`,
    })),
  });
}

function player(state: GameState, id: string) {
  return state.players.find((entry) => entry.id === id)!;
}

/** Replace a player's whole hand. */
function setTokens(state: GameState, id: string, tokens: Partial<Record<ResourceType, number>>) {
  player(state, id).tokens = { ...emptyTokens(), ...tokens };
}

let serial = 0;
function makeCard(bonus: GemType, cost: Card["cost"] = {}, points = 0, tier: 1 | 2 | 3 = 1): Card {
  serial += 1;
  return { id: `made-${serial}`, name: `Made ${serial}`, tier, points, bonus, cost, artwork: "x" };
}

function bonusCards(counts: Partial<Record<GemType, number>>): Card[] {
  return GEM_TYPES.flatMap((gem) => Array.from({ length: counts[gem] ?? 0 }, () => makeCard(gem)));
}

function apply(state: GameState, id: string, action: GameAction): GameState {
  const result = applyAction(state, id, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function reject(state: GameState, id: string, action: GameAction): string {
  const result = applyAction(state, id, action);
  if (result.ok) throw new Error("expected the action to be rejected");
  return result.error;
}

const noble = (id: string, requirement: Noble["requirement"]): Noble => ({
  id,
  name: id,
  points: 3,
  requirement,
  portrait: "aurelia",
});

describe("components", () => {
  it("uses five gem colours plus gold", () => {
    expect(GEM_TYPES).toEqual(["RUBY", "SAPPHIRE", "EMERALD", "ONYX", "PEARL"]);
  });

  it("has 40 / 30 / 20 development cards with 8 / 6 / 4 per colour", () => {
    const perColour = { 1: 8, 2: 6, 3: 4 } as const;
    for (const tier of [1, 2, 3] as const) {
      const cards = CARD_CATALOG.filter((card) => card.tier === tier);
      expect(cards).toHaveLength(perColour[tier] * 5);
      for (const gem of GEM_TYPES) {
        expect(cards.filter((card) => card.bonus === gem)).toHaveLength(perColour[tier]);
      }
    }
    expect(new Set(CARD_CATALOG.map((card) => card.id)).size).toBe(90);
  });

  it("has the intended prestige spread and a symmetric deck", () => {
    const points = (tier: number) =>
      CARD_CATALOG.filter((card) => card.tier === tier)
        .map((card) => card.points)
        .sort()
        .join(",");
    expect(points(1)).toBe([...Array(35).fill(0), ...Array(5).fill(1)].join(","));
    expect(points(2)).toBe([...Array(10).fill(1), ...Array(15).fill(2), ...Array(5).fill(3)].join(","));
    expect(points(3)).toBe([...Array(5).fill(3), ...Array(10).fill(4), ...Array(5).fill(5)].join(","));
    // Every colour gets the same set of cost shapes, so no colour is favoured.
    const shapes = (gem: GemType) =>
      CARD_CATALOG.filter((card) => card.bonus === gem)
        .map((card) =>
          `${card.tier}:${card.points}:${Object.values(card.cost).sort().join("")}`,
        )
        .sort()
        .join("|");
    for (const gem of GEM_TYPES) {
      expect(shapes(gem)).toBe(shapes("ONYX"));
    }
  });

  it("has ten patrons, all worth 3", () => {
    expect(ACHIEVEMENT_CATALOG).toHaveLength(10);
    const shapes = ACHIEVEMENT_CATALOG.map((entry) =>
      Object.values(entry.requirement).sort().join(""),
    ).sort();
    expect(shapes).toEqual([...Array(3).fill("2223"), ...Array(3).fill("333"), ...Array(4).fill("44")]);
    expect(ACHIEVEMENT_CATALOG.every((entry) => entry.points === 3)).toBe(true);
    expect(new Set(ACHIEVEMENT_CATALOG.map((entry) => JSON.stringify(entry.requirement))).size).toBe(10);
  });

  // Two players get 4 nobles by house rule (official: 3); see noblesCountByPlayers.
  it.each([
    [2, 4, 4],
    [3, 5, 4],
    [4, 7, 5],
  ])("sets up %i players with %i gems per colour and %i nobles", (count, gems, nobles) => {
    const state = start(count);
    for (const gem of GEM_TYPES) expect(state.bank[gem]).toBe(gems);
    expect(state.bank.ROYAL).toBe(5);
    expect(state.nobles).toHaveLength(nobles);
    for (const tier of ["tier1", "tier2", "tier3"] as const) {
      expect(state.market[tier].filter(Boolean)).toHaveLength(GAME_RULES.marketVisiblePerTier);
    }
    expect(state.decks.tier1).toHaveLength(36);
    expect(state.decks.tier2).toHaveLength(26);
    expect(state.decks.tier3).toHaveLength(16);
    expect(state.currentPlayerId).toBe("p1");
    for (const seat of state.players) {
      expect(totalTokens(seat.tokens)).toBe(0);
      expect(seat.cards).toEqual([]);
      expect(seat.reservedCards).toEqual([]);
      expect(seat.points).toBe(0);
    }
  });

  it("rejects one or five players", () => {
    expect(() => start(1)).toThrow();
    expect(() => start(5)).toThrow();
  });
});

describe("taking tokens", () => {
  it("allows two of a kind from a pile of exactly four", () => {
    const state = start(2);
    expect(state.bank.RUBY).toBe(4);
    const next = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "RUBY"] });
    expect(player(next, "p1").tokens.RUBY).toBe(2);
    expect(next.bank.RUBY).toBe(2);
  });

  it("refuses two of a kind from a pile of three", () => {
    const state = start(2);
    state.bank.RUBY = 3;
    reject(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "RUBY"] });
  });

  it("allows fewer than three different when fewer colours remain", () => {
    const state = start(2);
    for (const gem of ["RUBY", "SAPPHIRE", "EMERALD"] as const) state.bank[gem] = 0;
    const next = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["ONYX", "PEARL"] });
    expect(player(next, "p1").tokens.ONYX).toBe(1);
  });

  it("refuses a colour whose pile is empty, and duplicates in a three-take", () => {
    const state = start(2);
    state.bank.RUBY = 0;
    reject(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    reject(state, "p1", { type: "TAKE_TOKENS", tokens: ["SAPPHIRE", "SAPPHIRE", "EMERALD"] });
  });

  it("refuses any take while already holding 10 (house rule), but still allows reserving", () => {
    const state = start(2);
    setTokens(state, "p1", { RUBY: 2, SAPPHIRE: 2, EMERALD: 2, ONYX: 2, PEARL: 2 });
    expect(reject(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] })).toMatch(
      /already hold 10/,
    );
    reject(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
      discard: { ONYX: 2, PEARL: 1 },
    });
    expect(state.currentPlayerId).toBe("p1");
    const next = apply(state, "p1", { type: "RESERVE_CARD", deckTier: 1, discard: { ONYX: 1 } });
    expect(totalTokens(player(next, "p1").tokens)).toBe(10);
  });

  it("lets a player at 10 pass when they also cannot buy or reserve", () => {
    const state = start(2);
    setTokens(state, "p1", { ONYX: 10 });
    player(state, "p1").reservedCards = [
      makeCard("RUBY", { RUBY: 9 }),
      makeCard("RUBY", { RUBY: 9 }),
      makeCard("RUBY", { RUBY: 9 }),
    ];
    for (const row of ["tier1", "tier2", "tier3"] as const) {
      state.market[row] = state.market[row].map(() => makeCard("RUBY", { RUBY: 9 }));
    }
    expect(apply(state, "p1", { type: "PASS" }).currentPlayerId).toBe("p2");
  });

  it("with 9 held, taking three means returning two", () => {
    const state = start(2);
    setTokens(state, "p1", { RUBY: 2, SAPPHIRE: 2, EMERALD: 2, ONYX: 2, PEARL: 1 });
    const next = apply(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
      discard: { RUBY: 2 },
    });
    expect(totalTokens(player(next, "p1").tokens)).toBe(10);
  });

  it("counts gold toward the limit and lets gold be returned", () => {
    const state = start(2);
    setTokens(state, "p1", { ROYAL: 3, ONYX: 6 });
    const next = apply(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
      discard: { ROYAL: 2 },
    });
    expect(player(next, "p1").tokens.ROYAL).toBe(1);
    expect(next.bank.ROYAL).toBe(state.bank.ROYAL + 2);
  });

  it("rejects returning tokens when not over the limit", () => {
    const state = start(2);
    setTokens(state, "p1", { ONYX: 1 });
    reject(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY", "SAPPHIRE", "EMERALD"],
      discard: { ONYX: 1 },
    });
  });

  it("rejects fractional or unknown token amounts", () => {
    const state = start(2);
    setTokens(state, "p1", { ONYX: 10 });
    reject(state, "p1", {
      type: "TAKE_TOKENS",
      tokens: ["RUBY"],
      discard: { ONYX: 0.5, PEARL: 0.5 } as Partial<Record<ResourceType, number>>,
    });
  });
});

describe("reserving", () => {
  it("returns a token when the gold would make eleven", () => {
    const state = start(2);
    setTokens(state, "p1", { RUBY: 2, SAPPHIRE: 2, EMERALD: 2, ONYX: 2, PEARL: 2 });
    const cardId = state.market.tier1[0]!.id;
    expect(reject(state, "p1", { type: "RESERVE_CARD", cardId })).toMatch(/Return/);
    const next = apply(state, "p1", { type: "RESERVE_CARD", cardId, discard: { RUBY: 1 } });
    const me = player(next, "p1");
    expect(me.tokens.ROYAL).toBe(1);
    expect(totalTokens(me.tokens)).toBe(10);
    expect(next.bank.RUBY).toBe(state.bank.RUBY + 1);
  });

  it("may hand back the gold it just gained", () => {
    const state = start(2);
    setTokens(state, "p1", { ONYX: 10 });
    const next = apply(state, "p1", { type: "RESERVE_CARD", deckTier: 2, discard: { ROYAL: 1 } });
    expect(player(next, "p1").tokens.ROYAL).toBe(0);
    expect(next.bank.ROYAL).toBe(5);
    expect(player(next, "p1").reservedCards).toHaveLength(1);
  });

  it("still reserves when no gold remains, with no token and no return", () => {
    const state = start(2);
    state.bank.ROYAL = 0;
    setTokens(state, "p1", { ONYX: 10 });
    const cardId = state.market.tier2[1]!.id;
    const next = apply(state, "p1", { type: "RESERVE_CARD", cardId });
    expect(player(next, "p1").tokens.ROYAL).toBe(0);
    expect(player(next, "p1").reservedCards.map((card) => card.id)).toEqual([cardId]);
  });

  it("refuses a fourth reservation", () => {
    let state = start(2);
    for (let round = 0; round < 3; round += 1) {
      state = apply(state, "p1", { type: "RESERVE_CARD", deckTier: 1 });
      state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    }
    expect(player(state, "p1").reservedCards).toHaveLength(3);
    const before = state.currentPlayerId;
    reject(state, "p1", { type: "RESERVE_CARD", deckTier: 1 });
    reject(state, "p1", { type: "RESERVE_CARD", cardId: state.market.tier1[0]!.id });
    expect(state.currentPlayerId).toBe(before);
  });

  it("reserves blind from the top of a deck, hidden from others", () => {
    const state = start(2);
    const top = state.decks.tier3[0];
    const next = apply(state, "p1", { type: "RESERVE_CARD", deckTier: 3 });
    expect(player(next, "p1").reservedCards[0].id).toBe(top.id);
    expect(next.decks.tier3).toHaveLength(state.decks.tier3.length - 1);
    expect(JSON.stringify(toClientView(next, "p2"))).not.toContain(top.id);
  });

  it("refuses an empty deck or a missing card, and an out-of-range tier without crashing", () => {
    const state = start(2);
    state.decks.tier3 = [];
    reject(state, "p1", { type: "RESERVE_CARD", deckTier: 3 });
    reject(state, "p1", { type: "RESERVE_CARD", cardId: "no-such-card" });
    reject(state, "p1", { type: "RESERVE_CARD" });
    reject(state, "p1", { type: "RESERVE_CARD", deckTier: 4 as 1 });
  });

  it("lets only the owner buy a reserved card", () => {
    let state = start(2);
    const card = state.market.tier1[0]!;
    state = apply(state, "p1", { type: "RESERVE_CARD", cardId: card.id });
    setTokens(state, "p2", { RUBY: 5, SAPPHIRE: 5, EMERALD: 5, ONYX: 5, PEARL: 5 });
    const payment = { ...card.cost };
    reject(state, "p2", { type: "BUY_CARD", cardId: card.id, payment });
    setTokens(state, "p2", {});
    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    setTokens(state, "p1", { ...card.cost });
    const next = apply(state, "p1", { type: "BUY_CARD", cardId: card.id, payment });
    expect(player(next, "p1").reservedCards).toHaveLength(0);
    expect(player(next, "p1").cards.map((entry) => entry.id)).toEqual([card.id]);
  });
});

describe("buying and discounts", () => {
  it("buys for free when bonuses cover the whole cost", () => {
    const state = start(2);
    const card = makeCard("RUBY", { SAPPHIRE: 2, ONYX: 1 }, 1);
    state.market.tier1[0] = card;
    player(state, "p1").cards = bonusCards({ SAPPHIRE: 3, ONYX: 1 });
    const next = apply(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {} });
    expect(player(next, "p1").points).toBe(1);
    // Bonuses never make a cost negative: nothing comes back from the bank.
    expect(next.bank).toEqual(state.bank);
  });

  it("uses several gold tokens after bonuses, and returns payment to the bank", () => {
    const state = start(2);
    const card = makeCard("PEARL", { RUBY: 4, EMERALD: 2 }, 2, 2);
    state.market.tier2[0] = card;
    player(state, "p1").cards = bonusCards({ RUBY: 1 });
    setTokens(state, "p1", { RUBY: 1, EMERALD: 1, ROYAL: 3 });
    reject(state, "p1", {
      type: "BUY_CARD",
      cardId: card.id,
      payment: { RUBY: 1, EMERALD: 1, ROYAL: 2 },
    });
    const next = apply(state, "p1", {
      type: "BUY_CARD",
      cardId: card.id,
      payment: { RUBY: 1, EMERALD: 1, ROYAL: 3 },
    });
    expect(totalTokens(player(next, "p1").tokens)).toBe(0);
    expect(next.bank.ROYAL).toBe(state.bank.ROYAL + 3);
    expect(next.bank.RUBY).toBe(state.bank.RUBY + 1);
  });

  it("rejects overpaying, fractional payments and unknown tokens", () => {
    const state = start(2);
    const card = makeCard("PEARL", { RUBY: 1 });
    state.market.tier1[0] = card;
    setTokens(state, "p1", { RUBY: 2, ROYAL: 1 });
    reject(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: { RUBY: 2 } });
    reject(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: { RUBY: 1, ROYAL: 1 } });
    reject(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: { RUBY: 0.5, ROYAL: 0.5 } });
    reject(state, "p1", {
      type: "BUY_CARD",
      cardId: card.id,
      payment: { DIAMOND: 1 } as Partial<Record<ResourceType, number>>,
    });
    reject(state, "p1", { type: "BUY_CARD", cardId: "no-such-card", payment: {} });
  });

  it("refills the slot from the same tier, and leaves it empty once the deck runs out", () => {
    const state = start(2);
    const card = state.market.tier2[2]!;
    const nextInDeck = state.decks.tier2[0];
    setTokens(state, "p1", { ...card.cost });
    const next = apply(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: { ...card.cost } });
    expect(next.market.tier2[2]?.id).toBe(nextInDeck.id);

    const dry = start(2);
    dry.decks.tier1 = [];
    const last = dry.market.tier1[3]!;
    setTokens(dry, "p1", { ...last.cost });
    const after = apply(dry, "p1", { type: "BUY_CARD", cardId: last.id, payment: { ...last.cost } });
    expect(after.market.tier1[3]).toBeNull();
    expect(toClientView(after, "p1").deckCounts.tier1).toBe(0);
  });

  it("keeps bonuses per player", () => {
    const state = start(2);
    const card = makeCard("RUBY", { SAPPHIRE: 1 });
    state.market.tier1[0] = card;
    player(state, "p2").cards = bonusCards({ SAPPHIRE: 3 });
    reject(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {} });
  });
});

describe("nobles", () => {
  it("visits right after the purchase that qualifies, from bonuses only", () => {
    const state = start(2);
    state.nobles = [noble("n", { RUBY: 2 })];
    player(state, "p1").cards = bonusCards({ RUBY: 1 });
    setTokens(state, "p1", { RUBY: 5 });
    const card = makeCard("RUBY");
    state.market.tier1[0] = card;
    const next = apply(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {} });
    expect(player(next, "p1").achievements.map((entry) => entry.id)).toEqual(["n"]);
    expect(player(next, "p1").points).toBe(3);
    expect(next.nobles).toHaveLength(0);
    expect(next.currentPlayerId).toBe("p2");
  });

  it("ignores tokens for noble requirements", () => {
    const state = start(2);
    state.nobles = [noble("n", { RUBY: 3 })];
    setTokens(state, "p1", { RUBY: 5 });
    const next = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["SAPPHIRE", "EMERALD", "ONYX"] });
    expect(player(next, "p1").achievements).toHaveLength(0);
  });

  it("lets the player choose between several, and the other waits for a later turn", () => {
    let state = start(2);
    state.nobles = [noble("first", { RUBY: 1 }), noble("second", { RUBY: 1 })];
    const card = makeCard("RUBY");
    state.market.tier1[0] = card;
    state = apply(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {}, nobleId: "second" });
    expect(player(state, "p1").achievements.map((entry) => entry.id)).toEqual(["second"]);
    expect(state.nobles.map((entry) => entry.id)).toEqual(["first"]);

    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(player(state, "p1").achievements.map((entry) => entry.id)).toEqual(["second", "first"]);
    expect(player(state, "p1").points).toBe(6);
  });

  it("rejects choosing a noble the player does not qualify for", () => {
    const state = start(2);
    state.nobles = [noble("near", { RUBY: 1 }), noble("far", { ONYX: 4 })];
    const card = makeCard("RUBY");
    state.market.tier1[0] = card;
    reject(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {}, nobleId: "far" });
    reject(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {}, nobleId: "nobody" });
    expect(state.nobles).toHaveLength(2);
    expect(state.currentPlayerId).toBe("p1");
  });

  it("never gives the same noble twice", () => {
    let state = start(2);
    state.nobles = [noble("only", { RUBY: 1 })];
    player(state, "p1").cards = bonusCards({ RUBY: 2 });
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["ONYX", "PEARL", "SAPPHIRE"] });
    expect(player(state, "p1").achievements).toHaveLength(1);
    expect(player(state, "p1").points).toBe(3);
  });
});

describe("turns", () => {
  it("rejects acting out of turn, and invalid actions do not advance", () => {
    const state = start(3);
    reject(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    reject(state, "ghost", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    reject(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY"] });
    expect(state.currentPlayerId).toBe("p1");
  });

  it("wraps around the table and counts rounds", () => {
    let state = start(3);
    for (const id of ["p1", "p2", "p3"]) {
      state = apply(state, id, { type: "RESERVE_CARD", deckTier: 1 });
    }
    expect(state.currentPlayerId).toBe("p1");
    expect(state.turnNumber).toBe(2);
  });
});

describe("passing", () => {
  function stuck(): GameState {
    const state = start(2);
    for (const gem of GEM_TYPES) state.bank[gem] = 0;
    const me = player(state, "p1");
    me.reservedCards = [makeCard("RUBY", { RUBY: 9 }), makeCard("RUBY", { RUBY: 9 }), makeCard("RUBY", { RUBY: 9 })];
    return state;
  }

  it("is refused while any legal move exists", () => {
    const state = start(2);
    expect(reject(state, "p1", { type: "PASS" })).toMatch(/legal move/);
  });

  it("is allowed when the player cannot take, reserve or buy", () => {
    const state = stuck();
    expect(hasLegalAction(state, player(state, "p1"), 1)).toBe(false);
    const next = apply(state, "p1", { type: "PASS" });
    expect(next.currentPlayerId).toBe("p2");
  });
});

describe("end of game", () => {
  function nearWin(state: GameState, points: number) {
    const card = makeCard("RUBY", {}, points, 3);
    state.market.tier3[0] = card;
    return card;
  }

  it("finishes the round when the first player reaches exactly 15", () => {
    let state = start(3);
    player(state, "p1").cards = [makeCard("ONYX", {}, 12)];
    const card = nearWin(state, 3);
    state = apply(state, "p1", { type: "BUY_CARD", cardId: card.id, payment: {} });
    expect(player(state, "p1").points).toBe(15);
    expect(state.endgameTriggered).toBe(true);
    expect(state.status).toBe("PLAYING");
    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(state.status).toBe("PLAYING");
    state = apply(state, "p3", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(state.status).toBe("FINISHED");
    expect(state.winnerId).toBe("p1");
    reject(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
  });

  it("gives the remaining seats their turn when a middle seat triggers it", () => {
    let state = start(4);
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    player(state, "p2").cards = [makeCard("ONYX", {}, 14)];
    const card = nearWin(state, 4);
    state = apply(state, "p2", { type: "BUY_CARD", cardId: card.id, payment: {} });
    expect(player(state, "p2").points).toBe(18);
    state = apply(state, "p3", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(state.status).toBe("PLAYING");
    state = apply(state, "p4", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(state.status).toBe("FINISHED");
    expect(state.winnerId).toBe("p2");
  });

  it("ends straight away when the last seat triggers it", () => {
    let state = start(2);
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    player(state, "p2").cards = [makeCard("ONYX", {}, 15)];
    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(state.status).toBe("FINISHED");
    expect(state.winnerId).toBe("p2");
  });

  it("lets a later player overtake during the final round", () => {
    let state = start(2);
    player(state, "p1").cards = [makeCard("ONYX", {}, 15)];
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    player(state, "p2").cards = [makeCard("ONYX", {}, 14)];
    const card = nearWin(state, 3);
    state = apply(state, "p2", { type: "BUY_CARD", cardId: card.id, payment: {} });
    expect(state.status).toBe("FINISHED");
    expect(state.winnerId).toBe("p2");
  });

  it("breaks a points tie with the fewest development cards", () => {
    let state = start(2);
    player(state, "p1").cards = [makeCard("ONYX", {}, 5), makeCard("ONYX", {}, 5), makeCard("ONYX", {}, 5)];
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    // 15 from one card and a noble beats 15 from three cards.
    player(state, "p2").cards = [makeCard("ONYX", {}, 12)];
    player(state, "p2").achievements = [noble("n", { RUBY: 9 })];
    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(player(state, "p1").points).toBe(15);
    expect(player(state, "p2").points).toBe(15);
    expect(state.winnerId).toBe("p2");
  });

  it("scores from cards and nobles, not a stale points field", () => {
    let state = start(2);
    player(state, "p1").cards = [makeCard("ONYX", {}, 15)];
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    player(state, "p1").points = 0;
    state = apply(state, "p2", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    expect(state.winnerId).toBe("p1");
  });

  it("still finishes the round when the last seat has left", () => {
    let state = start(2);
    player(state, "p1").cards = [makeCard("ONYX", {}, 15)];
    state = apply(state, "p1", { type: "TAKE_TOKENS", tokens: ["RUBY", "SAPPHIRE", "EMERALD"] });
    const skipped = skipTurn(state, "p2");
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.status).toBe("FINISHED");
    expect(skipped.state.winnerId).toBe("p1");
  });
});
