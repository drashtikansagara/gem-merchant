import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parseCookie } from "cookie";
import { WebSocketServer, type WebSocket } from "ws";
import type { z } from "zod";
import { GameRoomManager, RoomError } from "@/server/GameRoomManager";
import { clientMessageSchema, createRoomBodySchema, joinRoomBodySchema } from "@/server/protocol";
import { logger } from "@/lib/logger";
import { loadLocalEnv } from "@/lib/loadEnv";
import {
  cookieHeader,
  createGuestId,
  readSession,
  SESSION_COOKIE,
  sessionSecret,
  signSession,
} from "@/lib/session";
import { GAME_RULES } from "@/game-engine/rules/constants";

const manager = new GameRoomManager();
const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_SECRET = "change-this-to-a-long-random-string";

function getSession(req: IncomingMessage): { id: string; setCookie?: string } {
  const secret = sessionSecret();
  const cookies = parseCookie(req.headers.cookie ?? "");
  // Cross-domain deployments pass the signed token in the URL (from /api/session),
  // because the website's cookie never reaches another domain.
  const urlToken = new URL(req.url ?? "/", "http://localhost").searchParams.get("token");
  const existing =
    readSession(urlToken ?? undefined, secret) ?? readSession(cookies[SESSION_COOKIE], secret);
  if (existing) {
    return existing;
  }
  const payload = { id: createGuestId() };
  return { ...payload, setCookie: cookieHeader(signSession(payload, secret)) };
}

class BadRequest extends Error {}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new BadRequest("Request too large.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Parse and validate a JSON body; malformed input is a 400, never a crash or a 500. */
async function readJson<T>(req: IncomingMessage, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = JSON.parse((await readBody(req)) || "{}");
  } catch (error) {
    if (error instanceof BadRequest) throw error;
    throw new BadRequest("Invalid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BadRequest("Invalid name, crest or player count.");
  }
  return result.data;
}

function json(res: ServerResponse, status: number, body: unknown, setCookie?: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  if (setCookie) {
    res.setHeader("Set-Cookie", setCookie);
  }
  res.end(JSON.stringify(body));
}

function publicRoom(room: Awaited<ReturnType<GameRoomManager["createRoom"]>>) {
  return {
    roomCode: room.roomCode,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    maxPlayers: room.maxPlayers,
    players: room.players.map(({ id, name, avatar, ready, connected }) => ({
      id,
      name,
      avatar,
      ready,
      connected,
    })),
  };
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const session = getSession(req);

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true }, session.setCookie);
      return;
    }

    if (req.method === "POST" && url.pathname === "/rooms") {
      const body = await readJson(req, createRoomBodySchema);
      const room = await manager.createRoom({
        hostPlayerId: session.id,
        name: body.name ?? "Merchant",
        avatar: body.avatar ?? "crest-1",
        maxPlayers: body.maxPlayers ?? GAME_RULES.minimumPlayers,
      });
      json(res, 201, publicRoom(room), session.setCookie);
      return;
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]+)$/i);
    if (req.method === "GET" && roomMatch) {
      const room = await manager.load(roomMatch[1].toUpperCase());
      if (!room) {
        json(res, 404, { error: "That table could not be found." }, session.setCookie);
        return;
      }
      json(
        res,
        200,
        // `seated` lets a returning player rejoin a full or running table.
        { ...publicRoom(room), seated: room.players.some((player) => player.id === session.id) },
        session.setCookie,
      );
      return;
    }

    const joinMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]+)\/join$/i);
    if (req.method === "POST" && joinMatch) {
      const body = await readJson(req, joinRoomBodySchema);
      const room = await manager.joinRoom({
        roomCode: joinMatch[1].toUpperCase(),
        playerId: session.id,
        name: body.name ?? "Merchant",
        avatar: body.avatar ?? "crest-1",
      });
      json(res, 200, publicRoom(room), session.setCookie);
      return;
    }

    const leaveMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]+)\/leave$/i);
    if (req.method === "POST" && leaveMatch) {
      await manager.leaveRoom(leaveMatch[1].toUpperCase(), session.id);
      json(res, 200, { ok: true }, session.setCookie);
      return;
    }

    json(res, 404, { error: "Not found" }, session.setCookie);
  } catch (error) {
    if (error instanceof RoomError || error instanceof BadRequest) {
      json(res, 400, { error: error.message });
      return;
    }
    logger.error("http error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    json(res, 500, { error: "The table could not be prepared." });
  }
});

// Game messages are tiny; cap frames so one client can't make the server buffer 100MB.
/** Comma-separated site origins allowed to open sockets, e.g. https://gem-merchant.vercel.app. Unset = any. */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const wss = new WebSocketServer({
  server: httpServer,
  path: "/ws",
  maxPayload: 16 * 1024,
  verifyClient: ({ origin }: { origin: string }) =>
    allowedOrigins.length === 0 || allowedOrigins.includes(origin),
});

wss.on("connection", (socket: WebSocket, req) => {
  const session = getSession(req);
  let boundRoom: string | null = null;
  let watchedRoom: string | null = null;

  socket.on("message", async (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      socket.send(JSON.stringify({ type: "ERROR", message: "Invalid message." }));
      return;
    }
    const message = clientMessageSchema.safeParse(parsed);
    if (!message.success) {
      socket.send(JSON.stringify({ type: "ERROR", message: "Invalid message." }));
      return;
    }
    try {
      const data = message.data;
      if (data.type === "PING") {
        socket.send(JSON.stringify({ type: "PONG" }));
        return;
      }
      if (data.type === "WATCH_GAME") {
        const room = await manager.watch(data.roomCode.toUpperCase(), socket);
        watchedRoom = room.roomCode;
        return;
      }
      if (data.type === "JOIN_GAME") {
        const room = await manager.joinRoom({
          roomCode: data.roomCode.toUpperCase(),
          playerId: session.id,
          name: data.name ?? "Merchant",
          avatar: data.avatar ?? "crest-1",
        });
        boundRoom = room.roomCode;
        manager.attachSocket(session.id, room.roomCode, socket);
        manager.sendSnapshot(session.id, room);
        return;
      }
      if (!boundRoom) {
        const message = watchedRoom ? "Spectators can only watch." : "Join a table first.";
        socket.send(JSON.stringify({ type: "ERROR", message }));
        return;
      }
      if (data.type === "READY") {
        await manager.setReady(session.id, boundRoom);
        return;
      }
      if (data.type === "START_GAME") {
        await manager.startGame(session.id, boundRoom);
        return;
      }
      if (data.type === "GAME_ACTION") {
        await manager.handleAction(session.id, boundRoom, data.action);
        return;
      }
      if (data.type === "LEAVE_GAME") {
        await manager.leaveRoom(boundRoom, session.id);
        return;
      }
      if (data.type === "REMATCH") {
        await manager.rematch(session.id, boundRoom);
      }
    } catch (error) {
      const text =
        error instanceof RoomError
          ? error.message
          : "The table could not process that action.";
      if (!(error instanceof RoomError)) {
        logger.error("ws message error", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
      socket.send(JSON.stringify({ type: "ERROR", message: text }));
    }
  });

  // Without an 'error' listener, a malformed frame is an uncaught exception
  // that takes the whole server down.
  socket.on("error", (error) => {
    logger.warn("ws socket error", { playerId: session.id, error: error.message });
  });

  socket.on("close", () => {
    if (watchedRoom) manager.unwatch(watchedRoom, socket);
    manager.handleDisconnect(session.id, socket);
  });
});

async function main() {
  loadLocalEnv();
  // Railway/Render/Fly assign PORT; WS_PORT wins for local development.
  const port = Number(process.env.WS_PORT ?? process.env.PORT ?? 3001);
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret === DEFAULT_SECRET)) {
    logger.error("refusing to start: set SESSION_SECRET to a long random value");
    process.exit(1);
  }
  try {
    await manager.restore();
  } catch (error) {
    logger.warn("mongodb restore skipped", {
      error: error instanceof Error ? error.message : "unavailable",
    });
  }
  httpServer.listen(port, () => {
    logger.info("websocket server listening", { port });
  });
}

void main();
