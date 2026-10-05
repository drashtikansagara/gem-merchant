export const GAME_RULES = {
  minimumPlayers: 2,
  maximumPlayers: 4,
  victoryPoints: 15,
  maxReservedCards: 3,
  maxTokensInHand: 10,
  marketVisiblePerTier: 4,
  takeDifferentTokens: 3,
  takeSameTokens: 2,
  takeSameMinBank: 4,
  royalOnReserve: true,
  /**
   * House rule: a player already holding the hand limit may not take gems at all
   * (official rules let them take and hand back). Reserving still works.
   */
  blockTakeAtHandLimit: true,
  /** Official is players + 1 (3 for two players); house rule shows 4 for two. */
  noblesCountByPlayers: {
    2: 4,
    3: 4,
    4: 5,
  } as Record<number, number>,
  bankTokensByPlayers: {
    2: { gem: 4, royal: 5 },
    3: { gem: 5, royal: 5 },
    4: { gem: 7, royal: 5 },
  } as Record<number, { gem: number; royal: number }>,
} as const;
