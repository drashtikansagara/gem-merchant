"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientGameState, GameAction, GameEvent } from "@/game-engine/types";
import type { LobbyPlayer } from "@/components/lobby/LobbyView";
import { useNotify } from "@/components/providers/NotifyProvider";

export interface RoomInfo {
  roomCode: string;
  status: "WAITING" | "PLAYING" | "FINISHED";
  hostPlayerId: string;
  maxPlayers: number;
  currentPlayerId: string | null;
  turnNumber: number;
  winnerId: string | null;
  /** People watching without a seat. */
  spectators?: number;
  players: LobbyPlayer[];
}

interface GameSocketState {
  connection: "connecting" | "ready" | "reconnecting";
  playerId: string | null;
  room: RoomInfo | null;
  state: ClientGameState | null;
  lastEvents: GameEvent[];
  /** Set when the server refused to seat us (wrong code, table full, game under way). */
  joinError: string | null;
  send: (message: unknown) => void;
  action: (action: GameAction) => void;
  ready: () => void;
  start: () => void;
  leave: () => void;
  rematch: () => void;
}

/**
 * Live connection to a table. With `spectate`, the socket only watches: no
 * seat, no identity, and the server sends a view with every secret hidden.
 */
export function useWebSocketGame(
  roomCode: string,
  identity: { name: string; avatar: string } | null,
  { spectate = false }: { spectate?: boolean } = {},
): GameSocketState {
  const { notify } = useNotify();
  const [connection, setConnection] = useState<GameSocketState["connection"]>("connecting");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [state, setState] = useState<ClientGameState | null>(null);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  // Depend on the values, not the object: a new identity object with the same
  // name/avatar must not tear down and reopen the socket.
  const name = identity?.name;
  const avatar = identity?.avatar;

  useEffect(() => {
    if (!spectate && (!name || !avatar)) {
      return;
    }
    let closed = false;
    let ping: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // Per connection: a rejoin can also be refused (e.g. seat expired mid-game).
    let seated = false;

    const connect = async () => {
      if (closed) return;
      seated = false;
      const base = gameServerUrl();
      const token = await sessionToken();
      if (closed) return;
      const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      setConnection(attempt === 0 ? "connecting" : "reconnecting");

      socket.onopen = () => {
        attempt = 0;
        setConnection("ready");
        socket.send(
          JSON.stringify(
            spectate
              ? { type: "WATCH_GAME", roomCode }
              : { type: "JOIN_GAME", roomCode, name, avatar },
          ),
        );
        ping = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "PING" }));
          }
        }, 15000);
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as {
          type: string;
          playerId?: string | null;
          room?: RoomInfo;
          state?: ClientGameState | null;
          message?: string;
          events?: GameEvent[];
        };
        if (message.type === "GAME_STATE") {
          seated = true;
          setPlayerId(message.playerId ?? null);
          if (message.room) setRoom(message.room);
          if (message.state !== undefined) setState(message.state);
        }
        if (message.type === "ERROR" && message.message) {
          if (!seated) {
            // The only thing we have asked for is a seat, so this is a join
            // failure. Stop reconnecting instead of spinning forever.
            closed = true;
            setJoinError(message.message);
            socket.close();
            return;
          }
          notify(message.message);
        }
        if (message.type === "GAME_EVENT" && message.events) {
          setLastEvents(message.events);
        }
      };

      socket.onclose = () => {
        if (ping) clearInterval(ping);
        if (closed) return;
        attempt += 1;
        setConnection("reconnecting");
        retry = setTimeout(() => void connect(), Math.min(8000, 600 * attempt));
      };
    };

    void connect();
    return () => {
      closed = true;
      if (ping) clearInterval(ping);
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [name, avatar, notify, roomCode, spectate]);

  const send = (message: unknown) => {
    socketRef.current?.send(JSON.stringify(message));
  };

  return {
    connection,
    playerId,
    room,
    state,
    lastEvents,
    joinError,
    send,
    action: (action) => send({ type: "GAME_ACTION", action }),
    ready: () => send({ type: "READY" }),
    start: () => send({ type: "START_GAME" }),
    leave: () => send({ type: "LEAVE_GAME" }),
    rematch: () => send({ type: "REMATCH" }),
  };
}

let cachedToken: Promise<string | null> | null = null;

/** Signed session token for the WebSocket server; fetched once per page load. */
function sessionToken(): Promise<string | null> {
  if (!cachedToken) {
    cachedToken = fetch("/api/session", { cache: "no-store" })
      .then(async (res) => {
        const body = res.ok ? ((await res.json()) as { token?: string }) : {};
        return body.token ?? null;
      })
      .catch(() => {
        cachedToken = null; // retry on the next connection attempt
        return null;
      });
  }
  return cachedToken;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Where to open the game socket. A configured `localhost` address only works in
 * the browser on this machine: someone opening the site as http://192.168.x.x:3100
 * would dial their *own* computer. So point loopback addresses at the host the
 * page was actually loaded from, keeping the configured port and path.
 */
function gameServerUrl(): string {
  const configured = process.env.API_URL ?? "ws://localhost:3001/ws";
  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    if (LOOPBACK.has(url.hostname) && !LOOPBACK.has(pageHost)) {
      url.hostname = pageHost;
      if (window.location.protocol === "https:") url.protocol = "wss:";
    }
    return url.toString();
  } catch {
    return configured;
  }
}
