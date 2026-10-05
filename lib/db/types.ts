import type { GameAction, GameState } from "@/game-engine/types";

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
  /** Left a game in progress (explicitly, or away past the reconnect window): turns are skipped. */
  left?: boolean;
  joinedAt: string;
}

export interface RoomRecord {
  roomCode: string;
  status: "WAITING" | "PLAYING" | "FINISHED";
  hostPlayerId: string;
  maxPlayers: number;
  currentPlayerId: string | null;
  players: RoomPlayer[];
  state: GameState | null;
  turnNumber: number;
  winnerId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GameMoveRecord {
  gameId: string;
  roomCode: string;
  playerId: string;
  actionType: GameAction["type"];
  payload: GameAction;
  turnNumber: number;
  createdAt: string;
}

export interface GameResultRecord {
  gameId: string;
  roomCode: string;
  winnerId: string;
  players: Array<{
    playerId: string;
    name: string;
    points: number;
    rank: number;
  }>;
  durationSeconds: number;
  createdAt: string;
}
