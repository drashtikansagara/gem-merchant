import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE } from "@/lib/config";

export interface SessionPayload {
  id: string;
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

export function createGuestId(): string {
  return `guest_${randomBytes(12).toString("hex")}`;
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(
  token: string | undefined,
  secret: string,
): SessionPayload | null {
  if (!token) {
    return null;
  }
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function cookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? "; Secure" : ""}`;
}

export { SESSION_COOKIE };
