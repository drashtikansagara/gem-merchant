import type { WebSocket } from "ws";

const hits = new Map<string, number[]>();

export function allowAction(playerId: string, limit = 20, windowMs = 10_000): boolean {
  const now = Date.now();
  const current = (hits.get(playerId) ?? []).filter((time) => now - time < windowMs);
  if (current.length >= limit) {
    hits.set(playerId, current);
    return false;
  }
  current.push(now);
  hits.set(playerId, current);
  return true;
}

export function closeQuietly(socket: WebSocket | undefined) {
  if (!socket) {
    return;
  }
  try {
    socket.close();
  } catch {
    /* ignore */
  }
}
