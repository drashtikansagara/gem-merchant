import type { ClientGameState, GameState } from "./types";

export function toClientView(state: GameState, playerId: string): ClientGameState {
  return {
    id: state.id,
    status: state.status,
    currentPlayerId: state.currentPlayerId,
    market: state.market,
    nobles: state.nobles,
    bank: state.bank,
    turnNumber: state.turnNumber,
    winnerId: state.winnerId,
    endgameTriggered: state.endgameTriggered,
    endedByForfeit: state.endedByForfeit,
    log: state.log,
    deckCounts: {
      tier1: state.decks.tier1.length,
      tier2: state.decks.tier2.length,
      tier3: state.decks.tier3.length,
    },
    players: state.players.map((player) => {
      if (player.id === playerId) {
        return { ...player, reservedCards: player.reservedCards };
      }
      // Market reserves are public; only blind deck draws stay secret. Old saves
      // without blindReserveIds hide everything, which is the safe default.
      const { blindReserveIds, ...rest } = player;
      return {
        ...rest,
        reservedCards: player.reservedCards.map((card, index) =>
          blindReserveIds && !blindReserveIds.includes(card.id)
            ? card
            : {
                // No card-derived data here: even the id length used to reveal the colour.
                id: `${player.id}-hidden-${index}`,
                hidden: true as const,
              },
        ),
      };
    }),
  };
}
