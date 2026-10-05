import { cookies } from "next/headers";
import {
  cookieHeader,
  createGuestId,
  readSession,
  SESSION_COOKIE,
  sessionSecret,
  signSession,
} from "@/lib/session";

/**
 * Hands the browser its signed session token so it can present it to the
 * WebSocket server, which may live on another domain (e.g. website on Vercel,
 * sockets on Railway) where this site's cookie is never sent.
 */
export async function GET() {
  const secret = sessionSecret();
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing && readSession(existing, secret)) {
    return Response.json({ token: existing }, { headers: { "cache-control": "no-store" } });
  }
  const token = signSession({ id: createGuestId() }, secret);
  return Response.json(
    { token },
    { headers: { "cache-control": "no-store", "set-cookie": cookieHeader(token) } },
  );
}
