import { requestCookieHeader } from "@/lib/requestCookies";
import { forward, proxyWs } from "@/lib/proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;
  const res = await proxyWs(`/rooms/${roomCode.toUpperCase()}`, {
    method: "GET",
    headers: { cookie: await requestCookieHeader() },
  });
  return forward(res);
}
