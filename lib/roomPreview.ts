import type { LobbyPlayer } from "@/components/lobby/LobbyView";

export interface RoomPreview {
  roomCode: string;
  status: "WAITING" | "PLAYING" | "FINISHED";
  hostPlayerId: string;
  maxPlayers: number;
  players: LobbyPlayer[];
  /** This browser already holds a seat at the table. */
  seated: boolean;
}

export type PreviewResult =
  | { ok: true; room: RoomPreview }
  | { ok: false; error: string };

/** Look up a table before trying to sit down, so problems show up front. */
export async function fetchRoomPreview(code: string): Promise<PreviewResult> {
  try {
    const res = await fetch(`/api/games/${encodeURIComponent(code.toUpperCase())}`, {
      cache: "no-store",
    });
    const body = (await res.json()) as Partial<RoomPreview> & { error?: string };
    if (res.status === 404) {
      return { ok: false, error: `No table found with the code ${code.toUpperCase()}.` };
    }
    if (!res.ok || !body.roomCode) {
      return { ok: false, error: body.error ?? "The table server is not available." };
    }
    return { ok: true, room: body as RoomPreview };
  } catch {
    return { ok: false, error: "The table server is not available." };
  }
}

/** Why this visitor can't take a seat, or null if they can. */
export function seatProblem(room: RoomPreview): string | null {
  if (room.seated) return null;
  if (room.status === "FINISHED") return "That game has already finished.";
  if (room.status === "PLAYING") return "That game is already under way.";
  if (room.players.length >= room.maxPlayers) {
    return `That table is full (${room.maxPlayers} of ${room.maxPlayers} seats taken).`;
  }
  return null;
}
