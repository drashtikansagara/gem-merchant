import { getDb, getMongoClient } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import type { GameMoveRecord, GameResultRecord, RoomRecord } from "@/lib/db/types";
import type { Collection } from "mongodb";

let indexesReady = false;

async function collections() {
  const db = await getDb();
  if (!db) {
    return null;
  }
  return {
    games: db.collection<RoomRecord>("games"),
    moves: db.collection<GameMoveRecord>("gameMoves"),
    results: db.collection<GameResultRecord>("gameResults"),
  };
}

export async function ensureIndexes(): Promise<void> {
  if (indexesReady) {
    return;
  }
  const cols = await collections();
  if (!cols) {
    return;
  }
  await cols.games.createIndex({ roomCode: 1 }, { unique: true });
  await cols.games.createIndex({ status: 1, updatedAt: -1 });
  await cols.games.createIndex({ updatedAt: -1 });
  await cols.moves.createIndex({ gameId: 1, createdAt: 1 });
  await cols.results.createIndex({ gameId: 1 }, { unique: true });
  indexesReady = true;
  logger.info("mongodb indexes ready");
}

export async function insertRoom(room: RoomRecord): Promise<void> {
  const cols = await collections();
  if (!cols) {
    return;
  }
  await cols.games.insertOne(room);
}

export async function replaceRoom(room: RoomRecord): Promise<void> {
  const cols = await collections();
  if (!cols) {
    return;
  }
  await cols.games.replaceOne({ roomCode: room.roomCode }, room, { upsert: true });
}

export async function findRoom(roomCode: string): Promise<RoomRecord | null> {
  const cols = await collections();
  if (!cols) {
    return null;
  }
  return cols.games.findOne({ roomCode });
}

export async function findActiveRooms(): Promise<RoomRecord[]> {
  const cols = await collections();
  if (!cols) {
    return [];
  }
  return cols.games
    .find({ status: { $in: ["WAITING", "PLAYING"] } })
    .toArray();
}

export async function insertMove(move: GameMoveRecord): Promise<void> {
  const cols = await collections();
  if (!cols) {
    return;
  }
  await cols.moves.insertOne(move);
}

export async function insertResult(result: GameResultRecord): Promise<void> {
  const cols = await collections();
  if (!cols) {
    return;
  }
  await cols.results.insertOne(result);
}

export async function persistActionAtomic(
  room: RoomRecord,
  move: GameMoveRecord,
  result?: GameResultRecord,
): Promise<boolean> {
  const db = await getDb();
  const client = await getMongoClient();
  if (!db || !client) {
    return true;
  }
  const games = db.collection<RoomRecord>("games");
  const moves = db.collection<GameMoveRecord>("gameMoves");
  const results = db.collection<GameResultRecord>("gameResults");

  try {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await games.replaceOne({ roomCode: room.roomCode }, room, {
          upsert: true,
          session,
        });
        await moves.insertOne(move, { session });
        if (result) {
          await results.insertOne(result, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    return true;
  } catch (error) {
    logger.warn("transaction unavailable, writing sequentially", {
      error: error instanceof Error ? error.message : "unknown",
    });
    try {
      await games.replaceOne({ roomCode: room.roomCode }, room, { upsert: true });
      await moves.insertOne(move);
      if (result) {
        await results.insertOne(result);
      }
      return true;
    } catch (writeError) {
      logger.error("mongodb persist failed", {
        error: writeError instanceof Error ? writeError.message : "unknown",
      });
      return false;
    }
  }
}

export function gamesCollection(): Promise<Collection<RoomRecord> | null> {
  return collections().then((cols) => cols?.games ?? null);
}
