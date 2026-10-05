"use client";

import { useCallback, useMemo, useState } from "react";
import {
  applyAction,
  createGame,
  toClientView,
  type GameAction,
  type GameEvent,
  type GameState,
} from "@/game-engine";

export function useLocalGame(playerCount = 2) {
  const [state, setState] = useState<GameState>(() => makeGame(playerCount));
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [viewerId, setViewerId] = useState(state.players[0].id);

  const restart = useCallback(
    (count = playerCount) => {
      // A fresh shuffle each time; only the first deal is fixed (it renders on the server too).
      const next = makeGame(count, Math.floor(Math.random() * 2 ** 32));
      setState(next);
      setViewerId(next.players[0].id);
      setLastEvents([]);
    },
    [playerCount],
  );

  const dispatch = useCallback(
    (action: GameAction): string | void => {
      const result = applyAction(state, state.currentPlayerId, action);
      if (!result.ok) {
        return result.error;
      }
      setState(result.state);
      setLastEvents(result.events);
      setViewerId(result.state.currentPlayerId);
    },
    [state],
  );

  const view = useMemo(() => toClientView(state, viewerId), [state, viewerId]);

  return {
    state,
    view,
    viewerId,
    lastEvents,
    dispatch,
    restart,
  };
}

function makeGame(playerCount: number, seed = 1729): GameState {
  const names = ["Player One", "Player Two", "Player Three", "Player Four"];
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: `local-${index + 1}`,
    name: names[index],
    avatar: `crest-${index + 1}`,
  }));
  return createGame({
    id: "local",
    players,
    seed,
  });
}
