import {
  applyAction,
  createGame,
  forfeitGame,
  skipTurn,
  toClientView,
  type GameAction,
  type GameEvent,
  type GameState,
} from "@/game-engine";
import { GAME_RULES } from "@/game-engine/rules/constants";
import type { RoomRecord } from "@/lib/db/types";
import {
  ensureIndexes,
  findActiveRooms,
  findRoom,
  insertRoom,
  persistActionAtomic,
  replaceRoom,
} from "@/lib/db/repository";
import { logger } from "@/lib/logger";
import { randomRoomCode } from "@/lib/roomCode";
import { allowAction, closeQuietly } from "@/server/rateLimit";
import type { WebSocket } from "ws";

const RECONNECT_MS = 45_000;

interface SocketBinding {
  playerId: string;
  roomCode: string;
  socket: WebSocket;
}

/** Player id no seat will ever have: toClientView then hides everyone's secrets. */
const SPECTATOR_VIEW = "__spectator__";
const MAX_SPECTATORS = 50;

export class GameRoomManager {
  private rooms = new Map<string, RoomRecord>();
  private sockets = new Map<string, SocketBinding>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Sockets watching a room without a seat, by room code. */
  private spectators = new Map<string, Set<WebSocket>>();
  /** Tail of each room's queue of state changes; see `serialized`. */
  private roomQueues = new Map<string, Promise<unknown>>();

  /**
   * Run room changes one at a time. Each handler awaits the database between
   * reading and writing the room, so two overlapping messages (a double click,
   * two players, a disconnect timer) would otherwise both validate against the
   * same old state and the later save would silently overwrite the earlier one.
   */
  private serialized<T>(roomCode: string, task: () => Promise<T>): Promise<T> {
    const code = roomCode.toUpperCase();
    const previous = this.roomQueues.get(code) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const tail = run.catch(() => undefined);
    this.roomQueues.set(code, tail);
    void tail.then(() => {
      if (this.roomQueues.get(code) === tail) this.roomQueues.delete(code);
    });
    return run;
  }

  async restore(): Promise<void> {
    await ensureIndexes();
    const active = await findActiveRooms();
    for (const room of active) {
      this.rooms.set(room.roomCode, room);
    }
    logger.info("rooms restored", { count: active.length });
  }

  async createRoom(input: {
    hostPlayerId: string;
    name: string;
    avatar: string;
    maxPlayers: number;
  }): Promise<RoomRecord> {
    const maxPlayers = Math.min(
      GAME_RULES.maximumPlayers,
      Math.max(GAME_RULES.minimumPlayers, input.maxPlayers),
    );
    let roomCode = randomRoomCode();
    while (this.rooms.has(roomCode) || (await findRoom(roomCode))) {
      roomCode = randomRoomCode();
    }
    const now = new Date().toISOString();
    const room: RoomRecord = {
      roomCode,
      status: "WAITING",
      hostPlayerId: input.hostPlayerId,
      maxPlayers,
      currentPlayerId: null,
      players: [
        {
          id: input.hostPlayerId,
          name: sanitizeName(input.name),
          avatar: input.avatar,
          ready: false,
          connected: true,
          joinedAt: now,
        },
      ],
      state: null,
      turnNumber: 0,
      winnerId: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    this.rooms.set(roomCode, room);
    await insertRoom(room);
    logger.info("game created", { roomCode, host: input.hostPlayerId });
    return room;
  }

  joinRoom(input: {
    roomCode: string;
    playerId: string;
    name: string;
    avatar: string;
  }): Promise<RoomRecord> {
    return this.serialized(input.roomCode, () => this.joinRoomNow(input));
  }

  private async joinRoomNow(input: {
    roomCode: string;
    playerId: string;
    name: string;
    avatar: string;
  }): Promise<RoomRecord> {
    const room = await this.load(input.roomCode);
    if (!room) {
      throw new RoomError("That table could not be found.");
    }
    const existing = room.players.find((player) => player.id === input.playerId);
    if (existing) {
      existing.connected = true;
      existing.left = false;
      // Mid-game the name is also baked into the game state; renaming only the
      // seat would make the two disagree.
      if (room.status === "WAITING") {
        existing.name = sanitizeName(input.name) || existing.name;
        existing.avatar = input.avatar || existing.avatar;
      }
      room.updatedAt = new Date().toISOString();
      await replaceRoom(room);
      this.broadcastLobby(room);
      return room;
    }
    if (room.status !== "WAITING") {
      throw new RoomError("That game is already under way.");
    }
    if (room.players.length >= room.maxPlayers) {
      throw new RoomError("That table is full.");
    }
    room.players.push({
      id: input.playerId,
      name: sanitizeName(input.name),
      avatar: input.avatar,
      ready: false,
      connected: true,
      joinedAt: new Date().toISOString(),
    });
    room.updatedAt = new Date().toISOString();
    await replaceRoom(room);
    logger.info("game join", { roomCode: room.roomCode, playerId: input.playerId });
    this.broadcast(room, {
      type: "PLAYER_JOINED",
      playerId: input.playerId,
      name: sanitizeName(input.name),
    });
    this.broadcastLobby(room);
    return room;
  }

  leaveRoom(roomCode: string, playerId: string): Promise<void> {
    return this.serialized(roomCode, () => this.leaveRoomNow(roomCode, playerId));
  }

  private async leaveRoomNow(roomCode: string, playerId: string): Promise<void> {
    const room = this.rooms.get(roomCode) ?? (await findRoom(roomCode));
    if (!room) {
      return;
    }
    this.rooms.set(room.roomCode, room);
    if (room.status === "PLAYING") {
      const player = room.players.find((entry) => entry.id === playerId);
      if (player) {
        player.connected = false;
        player.left = true;
      }
      await replaceRoom(room);
      this.broadcast(room, { type: "PLAYER_LEFT", playerId });
      this.broadcastLobby(room);
      // Don't let the table wait forever on someone who is gone.
      await this.settleAbsentPlayers(room);
      return;
    }
    room.players = room.players.filter((player) => player.id !== playerId);
    if (room.players.length === 0) {
      room.status = "FINISHED";
      room.finishedAt = new Date().toISOString();
    } else if (room.hostPlayerId === playerId) {
      room.hostPlayerId = room.players[0].id;
    }
    room.updatedAt = new Date().toISOString();
    await replaceRoom(room);
    this.broadcast(room, { type: "PLAYER_LEFT", playerId });
    this.broadcastLobby(room);
  }

  attachSocket(playerId: string, roomCode: string, socket: WebSocket) {
    const previous = this.sockets.get(playerId);
    if (previous && previous.socket !== socket) {
      closeQuietly(previous.socket);
    }
    this.sockets.set(playerId, { playerId, roomCode, socket });
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }
    const room = this.rooms.get(roomCode);
    if (room) {
      const player = room.players.find((entry) => entry.id === playerId);
      if (player) {
        player.connected = true;
      }
    }
    logger.info("ws connect", { playerId, roomCode });
  }

  handleDisconnect(playerId: string, socket: WebSocket) {
    const binding = this.sockets.get(playerId);
    // Only the socket currently bound to the player counts. A replaced socket
    // (second tab, fast reconnect) closing late must not unseat the new one.
    if (!binding || binding.socket !== socket) {
      return;
    }
    this.sockets.delete(playerId);
    logger.info("ws disconnect", { playerId, roomCode: binding.roomCode });
    const room = this.rooms.get(binding.roomCode);
    if (!room) {
      return;
    }
    const player = room.players.find((entry) => entry.id === playerId);
    if (player) {
      player.connected = false;
    }
    this.broadcastLobby(room);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(playerId);
      this.leaveRoom(binding.roomCode, playerId).catch((error: unknown) => {
        logger.error("leave after disconnect failed", {
          roomCode: binding.roomCode,
          error: error instanceof Error ? error.message : "unknown",
        });
      });
    }, RECONNECT_MS);
    this.disconnectTimers.set(playerId, timer);
  }

  setReady(playerId: string, roomCode: string): Promise<void> {
    return this.serialized(roomCode, () => this.setReadyNow(playerId, roomCode));
  }

  private async setReadyNow(playerId: string, roomCode: string): Promise<void> {
    const room = await this.requireRoom(roomCode);
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new RoomError("You are not at this table.");
    }
    player.ready = !player.ready;
    room.updatedAt = new Date().toISOString();
    await replaceRoom(room);
    this.broadcastLobby(room);
  }

  startGame(playerId: string, roomCode: string): Promise<void> {
    return this.serialized(roomCode, () => this.startGameNow(playerId, roomCode));
  }

  private async startGameNow(playerId: string, roomCode: string): Promise<void> {
    const room = await this.requireRoom(roomCode);
    if (room.status !== "WAITING") {
      throw new RoomError("The game has already started.");
    }
    if (room.hostPlayerId !== playerId) {
      throw new RoomError("Only the host can start the game.");
    }
    if (room.players.length < GAME_RULES.minimumPlayers) {
      throw new RoomError("Waiting for players...");
    }
    if (room.players.some((player) => !player.ready)) {
      throw new RoomError("Every merchant must be ready.");
    }
    const state = createGame({
      id: room.roomCode,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
      })),
    });
    room.state = state;
    room.status = "PLAYING";
    room.currentPlayerId = state.currentPlayerId;
    room.turnNumber = state.turnNumber;
    room.startedAt = new Date().toISOString();
    room.updatedAt = room.startedAt;
    await replaceRoom(room);
    logger.info("game start", { roomCode });
    this.broadcastState(room);
  }

  handleAction(playerId: string, roomCode: string, action: GameAction): Promise<void> {
    if (!allowAction(playerId)) {
      this.send(playerId, { type: "ERROR", message: "Too many actions. Wait a moment." });
      return Promise.resolve();
    }
    return this.serialized(roomCode, () => this.handleActionNow(playerId, roomCode, action));
  }

  private async handleActionNow(
    playerId: string,
    roomCode: string,
    action: GameAction,
  ): Promise<void> {
    const room = await this.requireRoom(roomCode);
    if (!room.state || room.status !== "PLAYING") {
      throw new RoomError("The game is not in progress.");
    }
    const result = applyAction(room.state, playerId, action);
    if (!result.ok) {
      logger.info("invalid action", {
        roomCode,
        playerId,
        action: action.type,
      });
      this.send(playerId, { type: "ERROR", message: result.error });
      return;
    }

    // Build the next room record without touching the live one: if saving
    // fails, the in-memory game must not have moved on without the database.
    const updated = withState(room, result.state);

    const move = {
      gameId: updated.roomCode,
      roomCode: updated.roomCode,
      playerId,
      actionType: action.type,
      payload: action,
      turnNumber: updated.turnNumber,
      createdAt: updated.updatedAt,
    };

    let gameResult = undefined;
    if (updated.status === "FINISHED" && updated.state) {
      const ranked = rankPlayers(updated.state);
      const started = updated.startedAt ? Date.parse(updated.startedAt) : Date.now();
      gameResult = {
        gameId: updated.roomCode,
        roomCode: updated.roomCode,
        winnerId: updated.winnerId ?? ranked[0].id,
        players: ranked.map((player, index) => ({
          playerId: player.id,
          name: player.name,
          points: player.points,
          rank: index + 1,
        })),
        durationSeconds: Math.max(1, Math.round((Date.now() - started) / 1000)),
        createdAt: updated.updatedAt,
      };
    }

    let persisted = false;
    try {
      persisted = await persistActionAtomic(updated, move, gameResult);
    } catch (error) {
      logger.error("persist action failed", {
        roomCode,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    if (!persisted) {
      this.send(playerId, {
        type: "ERROR",
        message: "The table could not be saved. Try again.",
      });
      return;
    }

    Object.assign(room, updated);
    this.announce(room, result.events);
    await this.settleAbsentPlayers(room);
  }

  /** Broadcast a state change, plus the finish message when the game ended. */
  private announce(room: RoomRecord, events: GameEvent[]) {
    this.broadcastEvents(room, events);
    this.broadcastState(room);
    if (room.status === "FINISHED") {
      logger.info("game finish", { roomCode: room.roomCode, winnerId: room.winnerId ?? "" });
      this.broadcast(room, {
        type: "GAME_FINISHED",
        winnerId: room.winnerId,
      });
    }
  }

  /**
   * Keep the game moving when players have left: skip their turns, and if too
   * few merchants remain, the last one standing wins by forfeit.
   */
  private async settleAbsentPlayers(room: RoomRecord): Promise<void> {
    if (room.status !== "PLAYING" || !room.state) {
      return;
    }
    let state = room.state;
    const events: GameEvent[] = [];
    const present = room.players.filter((player) => !player.left);

    if (present.length < GAME_RULES.minimumPlayers) {
      const result = forfeitGame(state, present[0]?.id ?? null);
      if (result.ok) {
        state = result.state;
        events.push(...result.events);
      }
    } else {
      // At most one lap around the table: every absent seat is passed once.
      for (let step = 0; step < room.players.length && state.status === "PLAYING"; step += 1) {
        const seat = room.players.find((player) => player.id === state.currentPlayerId);
        if (!seat?.left) break;
        const result = skipTurn(state, seat.id);
        if (!result.ok) break;
        state = result.state;
        events.push(...result.events);
      }
    }

    if (events.length === 0) {
      return;
    }
    const updated = withState(room, state);
    try {
      await replaceRoom(updated);
    } catch (error) {
      logger.error("persist skip failed", {
        roomCode: room.roomCode,
        error: error instanceof Error ? error.message : "unknown",
      });
      return;
    }
    Object.assign(room, updated);
    this.announce(room, events);
  }

  rematch(playerId: string, roomCode: string): Promise<void> {
    return this.serialized(roomCode, () => this.rematchNow(playerId, roomCode));
  }

  private async rematchNow(playerId: string, roomCode: string): Promise<void> {
    const room = await this.requireRoom(roomCode);
    if (room.status === "PLAYING") {
      // Another player already pressed Play Again; their snapshot reaches everyone.
      return;
    }
    if (room.status !== "FINISHED") {
      throw new RoomError("The game is not over yet.");
    }
    if (!room.players.some((p) => p.id === playerId)) {
      throw new RoomError("You are not at this table.");
    }
    // Check before touching the room, so a failed rematch leaves the result intact.
    if (room.players.length < GAME_RULES.minimumPlayers) {
      throw new RoomError("Not enough merchants remain for a rematch.");
    }
    if (room.players.some((p) => !p.connected)) {
      throw new RoomError("Waiting for everyone to return to the table.");
    }
    room.players.forEach((player) => {
      player.ready = true;
    });
    room.status = "WAITING";
    room.state = null;
    room.winnerId = null;
    room.finishedAt = null;
    room.startedAt = null;
    room.updatedAt = new Date().toISOString();
    await replaceRoom(room);
    // Already inside this room's queue: call the unqueued version.
    await this.startGameNow(room.hostPlayerId, room.roomCode);
  }

  /** Start streaming a room to a socket that has no seat. */
  async watch(roomCode: string, socket: WebSocket): Promise<RoomRecord> {
    const room = await this.requireRoom(roomCode);
    const watchers = this.spectators.get(room.roomCode) ?? new Set<WebSocket>();
    if (!watchers.has(socket) && watchers.size >= MAX_SPECTATORS) {
      throw new RoomError("This table already has the maximum number of spectators.");
    }
    watchers.add(socket);
    this.spectators.set(room.roomCode, watchers);
    socket.send(JSON.stringify(this.snapshot(room, null)));
    // Players see the spectator count change.
    this.broadcastLobby(room, { skipSpectators: true });
    logger.info("spectator joined", { roomCode: room.roomCode, count: watchers.size });
    return room;
  }

  unwatch(roomCode: string, socket: WebSocket) {
    const watchers = this.spectators.get(roomCode);
    if (!watchers?.delete(socket)) return;
    if (watchers.size === 0) this.spectators.delete(roomCode);
    const room = this.rooms.get(roomCode);
    if (room) this.broadcastLobby(room, { skipSpectators: true });
  }

  /** `viewerId` null = spectator: every player's hidden cards stay hidden. */
  snapshot(room: RoomRecord, viewerId: string | null) {
    return {
      type: "GAME_STATE" as const,
      playerId: viewerId,
      room: {
        roomCode: room.roomCode,
        status: room.status,
        hostPlayerId: room.hostPlayerId,
        maxPlayers: room.maxPlayers,
        currentPlayerId: room.currentPlayerId,
        turnNumber: room.turnNumber,
        winnerId: room.winnerId,
        spectators: this.spectators.get(room.roomCode)?.size ?? 0,
        players: room.players.map(({ id, name, avatar, ready, connected }) => ({
          id,
          name,
          avatar,
          ready,
          connected,
        })),
      },
      state: room.state ? toClientView(room.state, viewerId ?? SPECTATOR_VIEW) : null,
    };
  }

  sendSnapshot(playerId: string, room: RoomRecord) {
    this.send(playerId, this.snapshot(room, playerId));
  }

  private broadcastLobby(room: RoomRecord, options: { skipSpectators?: boolean } = {}) {
    for (const player of room.players) {
      this.sendSnapshot(player.id, room);
    }
    if (!options.skipSpectators) {
      this.sendToSpectators(room, this.snapshot(room, null));
    }
  }

  private broadcastState(room: RoomRecord) {
    this.broadcastLobby(room);
  }

  private sendToSpectators(room: RoomRecord, message: unknown) {
    const watchers = this.spectators.get(room.roomCode);
    if (!watchers) return;
    const data = JSON.stringify(message);
    for (const socket of watchers) {
      if (socket.readyState === 1) socket.send(data);
    }
  }

  private broadcastEvents(room: RoomRecord, events: unknown[]) {
    this.broadcast(room, { type: "GAME_EVENT", events });
    if (events.some((event) => (event as { type: string }).type === "TURN_CHANGED")) {
      this.broadcast(room, {
        type: "TURN_CHANGED",
        playerId: room.currentPlayerId,
      });
    }
  }

  private broadcast(room: RoomRecord, message: unknown) {
    for (const player of room.players) {
      this.send(player.id, message);
    }
    this.sendToSpectators(room, message);
  }

  send(playerId: string, message: unknown) {
    const binding = this.sockets.get(playerId);
    if (!binding || binding.socket.readyState !== 1) {
      return;
    }
    binding.socket.send(JSON.stringify(message));
  }

  async load(roomCode: string): Promise<RoomRecord | null> {
    const code = roomCode.toUpperCase();
    const cached = this.rooms.get(code);
    if (cached) {
      return cached;
    }
    const stored = await findRoom(code);
    if (stored) {
      this.rooms.set(code, stored);
    }
    return stored;
  }

  private async requireRoom(roomCode: string): Promise<RoomRecord> {
    const room = await this.load(roomCode);
    if (!room) {
      throw new RoomError("That table could not be found.");
    }
    this.rooms.set(room.roomCode, room);
    return room;
  }
}

export class RoomError extends Error {}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^\w\s'-]/g, "").trim();
  return cleaned.slice(0, 20) || "Merchant";
}

/** A copy of the room carrying a new game state, with the summary fields kept in sync. */
function withState(room: RoomRecord, state: GameState): RoomRecord {
  const now = new Date().toISOString();
  const finished = state.status === "FINISHED";
  return {
    ...room,
    state,
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    updatedAt: now,
    status: finished ? "FINISHED" : room.status,
    winnerId: finished ? (state.winnerId ?? null) : room.winnerId,
    finishedAt: finished ? now : room.finishedAt,
  };
}

/** Final standings with the engine's tie-break: more points, then fewer cards. */
function rankPlayers(state: GameState) {
  return [...state.players].sort(
    (a, b) => b.points - a.points || a.cards.length - b.cards.length,
  );
}
