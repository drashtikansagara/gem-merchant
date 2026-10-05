import { beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { toClientView, totalTokens, type GameAction } from "@/game-engine";
import { GameRoomManager } from "@/server/GameRoomManager";

// No database: the repository turns every call into a no-op.
delete process.env.MONGODB_URI;

interface Message {
  type: string;
  message?: string;
  state?: unknown;
}

class FakeSocket {
  readyState = 1;
  sent: Message[] = [];
  send(data: string) {
    this.sent.push(JSON.parse(data) as Message);
  }
  close() {
    this.readyState = 3;
  }
  last(type: string): Message | undefined {
    return [...this.sent].reverse().find((message) => message.type === type);
  }
}

const take = (...tokens: Array<"RUBY" | "SAPPHIRE" | "EMERALD" | "ONYX" | "PEARL">): GameAction => ({
  type: "TAKE_TOKENS",
  tokens,
});

let manager: GameRoomManager;
let roomCode: string;
let sockets: Record<"p1" | "p2", FakeSocket>;

async function room() {
  const loaded = await manager.load(roomCode);
  if (!loaded?.state) throw new Error("no game");
  return loaded;
}

beforeEach(async () => {
  manager = new GameRoomManager();
  const created = await manager.createRoom({ hostPlayerId: "p1", name: "Ada", avatar: "crest-1", maxPlayers: 2 });
  roomCode = created.roomCode;
  await manager.joinRoom({ roomCode, playerId: "p2", name: "Bo", avatar: "crest-2" });
  sockets = { p1: new FakeSocket(), p2: new FakeSocket() };
  manager.attachSocket("p1", roomCode, sockets.p1 as unknown as WebSocket);
  manager.attachSocket("p2", roomCode, sockets.p2 as unknown as WebSocket);
  await manager.setReady("p1", roomCode);
  await manager.setReady("p2", roomCode);
  await manager.startGame("p1", roomCode);
});

describe("room serialization", () => {
  it("applies only one of two overlapping moves from the same player", async () => {
    await Promise.all([
      manager.handleAction("p1", roomCode, take("RUBY", "SAPPHIRE", "EMERALD")),
      manager.handleAction("p1", roomCode, take("ONYX", "PEARL", "RUBY")),
    ]);
    const { state } = await room();
    expect(state!.currentPlayerId).toBe("p2");
    expect(totalTokens(state!.players[0].tokens)).toBe(3);
    expect(state!.bank.ONYX + state!.bank.PEARL).toBe(8);
    expect(sockets.p1.last("ERROR")?.message).toBe("It is not your turn.");
  });

  it("keeps the bank and hands consistent when both players send at once", async () => {
    await Promise.all([
      manager.handleAction("p2", roomCode, take("ONYX", "PEARL", "RUBY")),
      manager.handleAction("p1", roomCode, take("RUBY", "SAPPHIRE", "EMERALD")),
    ]);
    const { state } = await room();
    const held = state!.players.reduce((sum, seat) => sum + totalTokens(seat.tokens), 0);
    expect(held).toBe(3);
    expect(totalTokens(state!.bank) + held).toBe(4 * 5 + 5);
    expect(sockets.p2.last("ERROR")?.message).toBe("It is not your turn.");
  });
});

describe("synchronization and reconnection", () => {
  it("sends every seat its own view after a move", async () => {
    await manager.handleAction("p1", roomCode, { type: "RESERVE_CARD", deckTier: 1 });
    const { state } = await room();
    expect(sockets.p1.last("GAME_STATE")?.state).toEqual(toClientView(state!, "p1"));
    expect(sockets.p2.last("GAME_STATE")?.state).toEqual(toClientView(state!, "p2"));
    expect(JSON.stringify(sockets.p2.sent)).not.toContain(state!.players[0].reservedCards[0].id);
  });

  it("gives a returning player the current game without resetting it", async () => {
    manager.handleDisconnect("p2", sockets.p2 as unknown as WebSocket);
    await manager.handleAction("p1", roomCode, take("RUBY", "SAPPHIRE", "EMERALD"));
    const before = structuredClone((await room()).state);

    const again = new FakeSocket();
    const rejoined = await manager.joinRoom({ roomCode, playerId: "p2", name: "Bo", avatar: "crest-2" });
    manager.attachSocket("p2", roomCode, again as unknown as WebSocket);
    manager.sendSnapshot("p2", rejoined);

    const { state, players } = await room();
    expect(state).toEqual(before);
    expect(players).toHaveLength(2);
    expect(again.last("GAME_STATE")?.state).toEqual(toClientView(state!, "p2"));
    expect(state!.currentPlayerId).toBe("p2");
  });

  it("rejects moves once the game is over", async () => {
    await manager.leaveRoom(roomCode, "p2");
    const finished = await room();
    expect(finished.status).toBe("FINISHED");
    await expect(
      manager.handleAction("p1", roomCode, take("RUBY", "SAPPHIRE", "EMERALD")),
    ).rejects.toThrow("The game is not in progress.");
  });
});
